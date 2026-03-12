import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

// Mock shared utilities — alias paths resolved via moduleNameMapper in package.json
jest.mock('@shared/utils', () => ({
  createLogger: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }),
  CorrelationIdGenerator: { generate: () => 'test-correlation-id' },
}));
jest.mock('@shared/events', () => ({
  KAFKA_TOPICS: { USER_EVENTS: 'user.events' },
  UserCreatedEvent: {},
  UserUpdatedEvent: {},
}));

import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { UserAddress } from './entities/user-address.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { UserSession } from './entities/user-session.entity';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const mockKafkaClient = () => ({
  emit: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn().mockReturnValue(12),
});

describe('UserService', () => {
  let service: UserService;
  let userRepo: ReturnType<typeof mockRepository>;
  let preferencesRepo: ReturnType<typeof mockRepository>;
  let sessionRepo: ReturnType<typeof mockRepository>;
  let kafkaClient: ReturnType<typeof mockKafkaClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useFactory: mockRepository },
        { provide: getRepositoryToken(UserAddress), useFactory: mockRepository },
        { provide: getRepositoryToken(UserPreferences), useFactory: mockRepository },
        { provide: getRepositoryToken(UserSession), useFactory: mockRepository },
        { provide: 'KAFKA_SERVICE', useFactory: mockKafkaClient },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepo = module.get(getRepositoryToken(User));
    preferencesRepo = module.get(getRepositoryToken(UserPreferences));
    sessionRepo = module.get(getRepositoryToken(UserSession));
    kafkaClient = module.get('KAFKA_SERVICE');
  });

  describe('create', () => {
    const createInput = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'SecureP@ss1',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should create a user and hash the password', async () => {
      userRepo.findOne.mockResolvedValue(null);
      mockedBcrypt.hash = jest.fn().mockResolvedValue('hashed_password');

      const savedUser = { id: 'user-1', ...createInput, passwordHash: 'hashed_password' };
      userRepo.create.mockReturnValue(savedUser);
      userRepo.save.mockResolvedValue(savedUser);
      preferencesRepo.create.mockReturnValue({});
      preferencesRepo.save.mockResolvedValue({});

      const result = await service.create(createInput);

      expect(result).toEqual(savedUser);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(createInput.password, 12);
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ eventType: 'USER_CREATED', userId: 'user-1' })
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      userRepo.findOne.mockResolvedValue({ email: createInput.email, username: 'other' });

      await expect(service.create(createInput)).rejects.toThrow(ConflictException);
      await expect(service.create(createInput)).rejects.toThrow('Email already exists');
    });

    it('should throw ConflictException when username already exists', async () => {
      userRepo.findOne.mockResolvedValue({ email: 'other@example.com', username: createInput.username });

      await expect(service.create(createInput)).rejects.toThrow(ConflictException);
      await expect(service.create(createInput)).rejects.toThrow('Username already exists');
    });
  });

  describe('findOne', () => {
    it('should return a user when it exists', async () => {
      const user = { id: 'user-1', email: 'test@example.com' };
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findOne('user-1');
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update user fields and emit event', async () => {
      const existingUser = { id: 'user-1', email: 'test@example.com', firstName: 'Old' };
      const updatedUser = { ...existingUser, firstName: 'New' };

      userRepo.findOne.mockResolvedValue(existingUser);
      userRepo.save.mockResolvedValue(updatedUser);

      const result = await service.update('user-1', { firstName: 'New' });

      expect(result.firstName).toBe('New');
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ eventType: 'USER_UPDATED', userId: 'user-1' })
      );
    });
  });

  describe('validatePassword', () => {
    it('should return true for correct password', async () => {
      const user = { id: 'user-1', passwordHash: 'hashed' } as User;
      mockedBcrypt.compare = jest.fn().mockResolvedValue(true);

      const result = await service.validatePassword(user, 'correct_password');
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const user = { id: 'user-1', passwordHash: 'hashed' } as User;
      mockedBcrypt.compare = jest.fn().mockResolvedValue(false);

      const result = await service.validatePassword(user, 'wrong_password');
      expect(result).toBe(false);
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false and remove all sessions', async () => {
      const existingUser = { id: 'user-1', isActive: true };
      const deactivatedUser = { ...existingUser, isActive: false };

      userRepo.findOne.mockResolvedValue(existingUser);
      userRepo.save.mockResolvedValue(deactivatedUser);
      sessionRepo.delete.mockResolvedValue({ affected: 2 });

      const result = await service.deactivate('user-1', 'Requested by admin');

      expect(result.isActive).toBe(false);
      expect(sessionRepo.delete).toHaveBeenCalledWith({ user: { id: 'user-1' } });
    });
  });
});
