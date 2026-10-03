import { Test } from '@nestjs/testing';
import { ProfilesService } from './profiles.service';
import { ListsService } from '../lists/lists.service';
import { ProfileRepository } from '../persistence/profile.repository';

describe('ProfilesService', () => {
  const updateDisplayName = jest.fn();
  const ensureProfile = jest.fn();

  let service: ProfilesService;

  beforeEach(async () => {
    updateDisplayName.mockReset();
    ensureProfile.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: ListsService, useValue: { ensureProfile } },
        { provide: ProfileRepository, useValue: { updateDisplayName } },
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
    updateDisplayName.mockResolvedValue({
      id: 'user-1',
      email: 'ada@example.com',
      display_name: 'Ada Lovelace',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    const profile = await service.update(
      { id: 'user-1', email: 'ada@example.com' },
      { display_name: 'Ada Lovelace' },
    );

    expect(updateDisplayName).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        displayName: 'Ada Lovelace',
        action:
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

    const profile = await service.update(
      { id: 'user-1', email: 'ada@example.com' },
      { display_name: 'Ada' },
    );

    expect(updateDisplayName).not.toHaveBeenCalled();
    expect(profile.display_name).toBe('Ada');
  });
});
