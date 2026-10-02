import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { AuthUser } from '../common/auth-user';
import { InviteRow, ListRow, displayNameOf } from '../common/types';
import { ListsService } from '../lists/lists.service';
import { MailService } from '../mail/mail.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateInviteDto } from './dto/create-invite.dto';

@Injectable()
export class InvitesService {
  private readonly ttlDays: number;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly lists: ListsService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.ttlDays = Number(config.get('INVITE_TTL_DAYS') ?? 14);
  }

  async create(listId: string, user: AuthUser, dto: CreateInviteDto) {
    await this.lists.assertMember(listId, user.id);
    const email = dto.email.trim().toLowerCase();
    if (email === user.email.toLowerCase()) {
      throw new BadRequestException('You already have access to this list');
    }

    const { data: existingMember } = await this.supabase.client
      .from('profiles')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle();

    if (existingMember) {
      const { data: membership } = await this.supabase.client
        .from('list_members')
        .select('user_id')
        .eq('list_id', listId)
        .eq('user_id', existingMember.id)
        .maybeSingle();
      if (membership) {
        throw new ConflictException('That person already has access');
      }
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(
      Date.now() + this.ttlDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: existingInvite } = await this.supabase.client
      .from('list_invites')
      .select('*')
      .eq('list_id', listId)
      .eq('email', email)
      .maybeSingle();

    let invite: InviteRow;
    if (existingInvite && (existingInvite as InviteRow).status !== 'accepted') {
      const { data, error } = await this.supabase.client
        .from('list_invites')
        .update({
          token,
          status: 'pending',
          invited_by_id: user.id,
          expires_at: expiresAt,
        })
        .eq('id', existingInvite.id)
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? 'Could not update invite');
      }
      invite = data as InviteRow;
    } else if (existingInvite) {
      throw new ConflictException('That person already has access');
    } else {
      const { data, error } = await this.supabase.client
        .from('list_invites')
        .insert({
          list_id: listId,
          email,
          token,
          invited_by_id: user.id,
          status: 'pending',
          expires_at: expiresAt,
        })
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? 'Could not create invite');
      }
      invite = data as InviteRow;
    }

    const list = await this.getListName(listId);
    if (!list) {
      throw new NotFoundException('List not found');
    }
    const profile = await this.lists.ensureProfile(user);
    await this.mail.sendListInvite({
      to: email,
      listName: list.name,
      token: invite.token,
      invitedBy: displayNameOf(profile),
    });

    return this.toPublicInvite(invite);
  }

  async list(listId: string, userId: string) {
    await this.lists.assertMember(listId, userId);
    const { data, error } = await this.supabase.client
      .from('list_invites')
      .select('id, list_id, email, status, expires_at, created_at')
      .eq('list_id', listId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return data ?? [];
  }

  async revoke(listId: string, inviteId: string, userId: string) {
    await this.lists.assertMember(listId, userId);
    const { error } = await this.supabase.client
      .from('list_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
      .eq('list_id', listId)
      .eq('status', 'pending');

    if (error) {
      throw new Error(error.message);
    }
    return { ok: true };
  }

  async acceptByToken(token: string, user: AuthUser) {
    const invite = await this.getPendingInvite(token);
    if (invite.email !== user.email.toLowerCase()) {
      throw new BadRequestException(
        'This invite was sent to a different email address',
      );
    }
    await this.lists.ensureProfile(user);
    await this.acceptInvite(invite, user.id);
    return { list_id: invite.list_id };
  }

  async acceptPendingForEmail(user: AuthUser) {
    await this.lists.ensureProfile(user);
    const { data, error } = await this.supabase.client
      .from('list_invites')
      .select('*')
      .eq('email', user.email.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (error) {
      throw new Error(error.message);
    }

    const accepted: string[] = [];
    for (const row of data ?? []) {
      const invite = row as InviteRow;
      await this.acceptInvite(invite, user.id);
      accepted.push(invite.list_id);
    }
    return { accepted_list_ids: accepted };
  }

  async getInvitePreview(token: string) {
    const { data, error } = await this.supabase.client
      .from('list_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new NotFoundException('Invite not found');
    }

    const invite = data as InviteRow;
    const expired = new Date(invite.expires_at).getTime() < Date.now();
    const list = await this.getListName(invite.list_id, true);
    return {
      list_name: list?.name ?? 'Grocery list',
      email: invite.email,
      status: expired && invite.status === 'pending' ? 'expired' : invite.status,
    };
  }

  private async acceptInvite(invite: InviteRow, userId: string) {
    const { error: memberError } = await this.supabase.client
      .from('list_members')
      .upsert(
        {
          list_id: invite.list_id,
          user_id: userId,
          role: 'editor',
        },
        { onConflict: 'list_id,user_id' },
      );

    if (memberError) {
      throw new Error(memberError.message);
    }

    await this.supabase.client
      .from('list_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    await this.lists.emitMembersChanged(invite.list_id);
  }

  private async getPendingInvite(token: string): Promise<InviteRow> {
    const { data, error } = await this.supabase.client
      .from('list_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new NotFoundException('Invite not found');
    }
    const invite = data as InviteRow;
    if (invite.status !== 'pending') {
      throw new BadRequestException('This invite is no longer pending');
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new BadRequestException('This invite has expired');
    }
    return invite;
  }

  private async getListName(listId: string, allowMissing = false) {
    const { data, error } = await this.supabase.client
      .from('lists')
      .select('id, name, deleted_at')
      .eq('id', listId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data || data.deleted_at) {
      if (allowMissing) return null;
      throw new NotFoundException('List not found');
    }
    return data as Pick<ListRow, 'id' | 'name'>;
  }

  private toPublicInvite(invite: InviteRow) {
    return {
      id: invite.id,
      list_id: invite.list_id,
      email: invite.email,
      status: invite.status,
      expires_at: invite.expires_at,
      created_at: invite.created_at,
    };
  }
}
