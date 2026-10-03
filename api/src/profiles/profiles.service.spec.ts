import { Test } from '@nestjs/testing';
import { ProfilesService } from './profiles.service';
import { ListsService } from '../lists/lists.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ProfilesService', () => {
  const rpc = jest.fn();
  const ensureProfile = jest.fn();

  let service: ProfilesService;

  beforeEach(async () => {
    rpc.mockReset();
    ensureProfile.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: ListsService, useValue: { ensureProfile } },
        { provide: SupabaseService, useValue: { client: { rpc } } },
      ],
    }).compile();
    service = moduleRef.get(ProfilesService);
  });

  it('logs a display name change', async () => {
    ensureProfile.mockResolvedValue({
      id: 'user-1',
      email: 'ada@example.com',
      display_name: 'Ada',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    rpc.mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'ada@example.com',
        display_name: 'Ada Lovelace',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });

    const profile = await service.update(
      { id: 'user-1', email: 'ada@example.com' },
      { display_name: 'Ada Lovelace' },
    );

    expect(rpc).toHaveBeenCalledWith(
      'apply_profile_update',
      expect.objectContaining({
        p_actor_id: 'user-1',
        p_patch: { display_name: 'Ada Lovelace' },
        p_action:
          'User Ada (user-1) updated the profile (user-1) field display_name from Ada to Ada Lovelace.',
      }),
    );
    expect(profile.display_name).toBe('Ada Lovelace');
  });

  it('does not log when the display name is unchanged', async () => {
    ensureProfile.mockResolvedValue({
      id: 'user-1',
      email: 'ada@example.com',
      display_name: 'Ada',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    const profile = await service.update({ id: 'user-1', email: 'ada@example.com' }, { display_name: 'Ada' });

    expect(rpc).not.toHaveBeenCalled();
    expect(profile.display_name).toBe('Ada');
  });
});
