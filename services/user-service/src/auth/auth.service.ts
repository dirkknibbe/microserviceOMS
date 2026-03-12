import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { createLogger, CorrelationIdGenerator } from '@shared/utils';

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  jti: string;
}

@Injectable()
export class AuthService {
  private readonly logger = createLogger('AuthService');

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(emailOrUsername: string, password: string): Promise<User | null> {
    const correlationId = CorrelationIdGenerator.generate();
    
    this.logger.info('Validating user credentials', {
      correlationId,
      emailOrUsername,
    });

    const user = await this.userService.findByEmailOrUsername(emailOrUsername);
    
    if (!user) {
      this.logger.warn('User not found', { correlationId, emailOrUsername });
      return null;
    }

    if (!user.isActive) {
      this.logger.warn('User account is deactivated', { correlationId, userId: user.id });
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await this.userService.validatePassword(user, password);
    
    if (!isPasswordValid) {
      this.logger.warn('Invalid password', { correlationId, userId: user.id });
      return null;
    }

    this.logger.info('User credentials validated successfully', {
      correlationId,
      userId: user.id,
    });

    return user;
  }

  async login(emailOrUsername: string, password: string): Promise<LoginResponse> {
    const correlationId = CorrelationIdGenerator.generate();
    
    this.logger.info('User login attempt', {
      correlationId,
      emailOrUsername,
    });

    const user = await this.validateUser(emailOrUsername, password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const jti = CorrelationIdGenerator.generate();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      jti,
    };

    const accessToken = this.jwtService.sign(payload);

    // Create session record
    await this.userService.createSession(user.id, jti);

    this.logger.info('User logged in successfully', {
      correlationId,
      userId: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user,
    };
  }

  async logout(jti: string): Promise<void> {
    const correlationId = CorrelationIdGenerator.generate();
    
    this.logger.info('User logout', {
      correlationId,
      jti,
    });

    await this.userService.removeSession(jti);

    this.logger.info('User logged out successfully', {
      correlationId,
      jti,
    });
  }

  async validateToken(payload: JwtPayload): Promise<User | null> {
    const session = await this.userService.findSessionByJti(payload.jti);
    
    if (!session) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      await this.userService.removeSession(payload.jti);
      return null;
    }

    return session.user;
  }

  async refreshToken(user: User, oldJti: string): Promise<string> {
    const correlationId = CorrelationIdGenerator.generate();
    
    this.logger.info('Refreshing token', {
      correlationId,
      userId: user.id,
    });

    // Remove old session
    await this.userService.removeSession(oldJti);

    // Create new token
    const newJti = CorrelationIdGenerator.generate();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      jti: newJti,
    };

    const accessToken = this.jwtService.sign(payload);

    // Create new session
    await this.userService.createSession(user.id, newJti);

    this.logger.info('Token refreshed successfully', {
      correlationId,
      userId: user.id,
    });

    return accessToken;
  }
}