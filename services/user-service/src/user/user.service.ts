import { Injectable, Inject, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { UserAddress } from './entities/user-address.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { UserSession } from './entities/user-session.entity';
import { CreateUserInput, UpdateUserInput } from './dto/create-user.dto';
import { createLogger, CorrelationIdGenerator } from '@shared/utils';
import { UserCreatedEvent, UserUpdatedEvent, KAFKA_TOPICS } from '@shared/events';

@Injectable()
export class UserService {
  private readonly logger = createLogger('UserService');

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepository: Repository<UserAddress>,
    @InjectRepository(UserPreferences)
    private readonly userPreferencesRepository: Repository<UserPreferences>,
    @InjectRepository(UserSession)
    private readonly userSessionRepository: Repository<UserSession>,
    @Inject('KAFKA_SERVICE')
    private readonly kafkaClient: ClientProxy,
    private readonly configService: ConfigService,
  ) {}

  async create(createUserInput: CreateUserInput): Promise<User> {
    const correlationId = CorrelationIdGenerator.generate();
    
    this.logger.info('Creating new user', {
      correlationId,
      email: createUserInput.email,
      username: createUserInput.username,
    });

    // Check if email or username already exists
    const existingUser = await this.userRepository.findOne({
      where: [
        { email: createUserInput.email },
        { username: createUserInput.username },
      ],
    });

    if (existingUser) {
      if (existingUser.email === createUserInput.email) {
        throw new ConflictException('Email already exists');
      }
      if (existingUser.username === createUserInput.username) {
        throw new ConflictException('Username already exists');
      }
    }

    try {
      // Hash password
      const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 12);
      const passwordHash = await bcrypt.hash(createUserInput.password, saltRounds);

      // Create user
      const user = this.userRepository.create({
        email: createUserInput.email,
        username: createUserInput.username,
        passwordHash,
        firstName: createUserInput.firstName,
        lastName: createUserInput.lastName,
        phone: createUserInput.phone,
      });

      const savedUser = await this.userRepository.save(user);

      // Create default preferences
      const preferences = this.userPreferencesRepository.create({
        user: savedUser,
      });
      await this.userPreferencesRepository.save(preferences);

      // Emit user created event
      const userCreatedEvent: UserCreatedEvent = {
        eventType: 'USER_CREATED',
        userId: savedUser.id,
        email: savedUser.email,
        username: savedUser.username,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        timestamp: new Date(),
        correlationId,
      };

      this.kafkaClient.emit(KAFKA_TOPICS.USER_EVENTS, userCreatedEvent);

      this.logger.info('User created successfully', {
        correlationId,
        userId: savedUser.id,
        email: savedUser.email,
      });

      return savedUser;
    } catch (error) {
      this.logger.error('Failed to create user', { correlationId }, error);
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['addresses', 'preferences'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['addresses', 'preferences'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['addresses', 'preferences'],
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
      relations: ['addresses', 'preferences'],
    });
  }

  async findByEmailOrUsername(emailOrUsername: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: [
        { email: emailOrUsername },
        { username: emailOrUsername },
      ],
      relations: ['addresses', 'preferences'],
    });
  }

  async update(id: string, updateUserInput: UpdateUserInput): Promise<User> {
    const correlationId = CorrelationIdGenerator.generate();
    
    this.logger.info('Updating user', {
      correlationId,
      userId: id,
      updateFields: Object.keys(updateUserInput),
    });

    const user = await this.findOne(id);

    Object.assign(user, updateUserInput);
    const updatedUser = await this.userRepository.save(user);

    // Emit user updated event
    const userUpdatedEvent: UserUpdatedEvent = {
      eventType: 'USER_UPDATED',
      userId: updatedUser.id,
      updatedFields: updateUserInput,
      timestamp: new Date(),
      correlationId,
    };

    this.kafkaClient.emit(KAFKA_TOPICS.USER_EVENTS, userUpdatedEvent);

    this.logger.info('User updated successfully', {
      correlationId,
      userId: updatedUser.id,
    });

    return updatedUser;
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async changePassword(id: string, newPassword: string): Promise<void> {
    const correlationId = CorrelationIdGenerator.generate();
    
    this.logger.info('Changing user password', {
      correlationId,
      userId: id,
    });

    const user = await this.findOne(id);
    
    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.userRepository.update(id, { passwordHash });

    this.logger.info('Password changed successfully', {
      correlationId,
      userId: id,
    });
  }

  async deactivate(id: string, reason: string): Promise<User> {
    const correlationId = CorrelationIdGenerator.generate();
    
    this.logger.info('Deactivating user', {
      correlationId,
      userId: id,
      reason,
    });

    const user = await this.findOne(id);
    user.isActive = false;

    const deactivatedUser = await this.userRepository.save(user);

    // Invalidate all user sessions
    await this.userSessionRepository.delete({ user: { id } });

    this.logger.info('User deactivated successfully', {
      correlationId,
      userId: id,
    });

    return deactivatedUser;
  }

  async createSession(userId: string, tokenJti: string, deviceInfo?: string, ipAddress?: string): Promise<UserSession> {
    const user = await this.findOne(userId);
    
    const session = this.userSessionRepository.create({
      user,
      tokenJti,
      deviceInfo,
      ipAddress,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    return this.userSessionRepository.save(session);
  }

  async findSessionByJti(jti: string): Promise<UserSession | null> {
    return this.userSessionRepository.findOne({
      where: { tokenJti: jti },
      relations: ['user'],
    });
  }

  async removeSession(jti: string): Promise<void> {
    await this.userSessionRepository.delete({ tokenJti: jti });
  }

  async removeAllUserSessions(userId: string): Promise<void> {
    await this.userSessionRepository.delete({ user: { id: userId } });
  }
}