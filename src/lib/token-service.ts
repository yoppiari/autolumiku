/**
 * Token Service
 * Handles secure token generation and validation for team invitations
 */

import crypto from 'crypto';
import { Logger } from '@/lib/logger';
import { Cache } from '@/lib/cache';

interface InvitationTokenData {
  email: string;
  tenantId: string;
  expiresIn?: string;
  issuedAt?: number;
}

export class TokenService {
  private readonly logger: Logger;
  private readonly cache: Cache;

  constructor() {
    this.logger = new Logger('TokenService');
    this.cache = new Cache('tokens', 60 * 24); // 24 hour cache
  }

  /**
   * Generate secure invitation token
   */
  async generateInvitationToken(data: InvitationTokenData): Promise<string> {
    const {
      email,
      tenantId,
      expiresIn = '7d',
      issuedAt = Date.now()
    } = data;

    // Create token payload
    const payload = {
      email,
      tenantId,
      issuedAt,
      expiresAt: this.calculateExpiration(expiresIn),
      type: 'invitation',
      version: '1'
    };

    // Create signature
    const signature = this.createSignature(payload);

    // Combine payload and signature
    const token = this.encodeToken(payload, signature);

    // Cache token metadata
    await this.cacheToken(token, payload);

    this.logger.info('Invitation token generated', {
      email,
      tenantId,
      expiresIn,
      tokenId: this.getTokenId(token)
    });

    return token;
  }

  /**
   * Validate invitation token
   */
  async validateInvitationToken(token: string): Promise<InvitationTokenData & { isValid: boolean; reason?: string }> {
    try {
      // Decode token
      const { payload, signature } = this.decodeToken(token);

      // Verify signature
      if (!this.verifySignature(payload, signature)) {
        return {
          email: payload.email,
          tenantId: payload.tenantId,
          isValid: false,
          reason: 'Invalid signature'
        };
      }

      // Check expiration
      if (payload.expiresAt < Date.now()) {
        return {
          email: payload.email,
          tenantId: payload.tenantId,
          isValid: false,
          reason: 'Token expired'
        };
      }

      // Check if token has been revoked (from cache)
      const isRevoked = await this.isTokenRevoked(token);
      if (isRevoked) {
        return {
          email: payload.email,
          tenantId: payload.tenantId,
          isValid: false,
          reason: 'Token revoked'
        };
      }

      return {
        email: payload.email,
        tenantId: payload.tenantId,
        isValid: true
      };
    } catch (error) {
      this.logger.error('Token validation failed', { error, token });
      return {
        email: '',
        tenantId: '',
        isValid: false,
        reason: 'Invalid token format'
      };
    }
  }

  /**
   * Revoke token
   */
  async revokeToken(token: string): Promise<void> {
    await this.cache.set(`revoked:${token}`, 'true', 7 * 24 * 60 * 60); // 7 days
    this.logger.info('Token revoked', { tokenId: this.getTokenId(token) });
  }

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(userId: string, email: string): Promise<string> {
    const payload = {
      userId,
      email,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
      type: 'password_reset',
      version: '1'
    };

    const signature = this.createSignature(payload);
    const token = this.encodeToken(payload, signature);

    await this.cacheToken(token, payload);

    this.logger.info('Password reset token generated', {
      userId,
      email,
      tokenId: this.getTokenId(token)
    });

    return token;
  }

  /**
   * Validate password reset token
   */
  async validatePasswordResetToken(token: string): Promise<{
    isValid: boolean;
    userId?: string;
    email?: string;
    reason?: string;
  }> {
    try {
      const { payload, signature } = this.decodeToken(token);

      if (!this.verifySignature(payload, signature)) {
        return { isValid: false, reason: 'Invalid signature' };
      }

      if (payload.type !== 'password_reset') {
        return { isValid: false, reason: 'Invalid token type' };
      }

      if (payload.expiresAt < Date.now()) {
        return { isValid: false, reason: 'Token expired' };
      }

      if (await this.isTokenRevoked(token)) {
        return { isValid: false, reason: 'Token revoked' };
      }

      return {
        isValid: true,
        userId: payload.userId,
        email: payload.email
      };
    } catch (error) {
      this.logger.error('Password reset token validation failed', { error, token });
      return { isValid: false, reason: 'Invalid token format' };
    }
  }

  /**
   * Generate session token
   */
  async generateSessionToken(userId: string, tenantId: string): Promise<string> {
    const payload = {
      userId,
      tenantId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      type: 'session',
      version: '1'
    };

    const signature = this.createSignature(payload);
    const token = this.encodeToken(payload, signature);

    await this.cacheToken(token, payload);

    return token;
  }

  /**
   * Validate session token
   */
  async validateSessionToken(token: string): Promise<{
    isValid: boolean;
    userId?: string;
    tenantId?: string;
    reason?: string;
  }> {
    try {
      const { payload, signature } = this.decodeToken(token);

      if (!this.verifySignature(payload, signature)) {
        return { isValid: false, reason: 'Invalid signature' };
      }

      if (payload.type !== 'session') {
        return { isValid: false, reason: 'Invalid token type' };
      }

      if (payload.expiresAt < Date.now()) {
        return { isValid: false, reason: 'Token expired' };
      }

      if (await this.isTokenRevoked(token)) {
        return { isValid: false, reason: 'Token revoked' };
      }

      return {
        isValid: true,
        userId: payload.userId,
        tenantId: payload.tenantId
      };
    } catch (error) {
      this.logger.error('Session token validation failed', { error, token });
      return { isValid: false, reason: 'Invalid token format' };
    }
  }

  /**
   * Extract token ID for logging (without revealing sensitive data)
   */
  private getTokenId(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 8);
  }

  /**
   * Calculate expiration timestamp
   */
  private calculateExpiration(expiresIn: string): number {
    const timeValue = parseInt(expiresIn.slice(0, -1));
    const timeUnit = expiresIn.slice(-1);

    const milliseconds = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };

    return Date.now() + (timeValue * (milliseconds[timeUnit as keyof typeof milliseconds] || 0));
  }

  /**
   * Create signature for token payload
   */
  private createSignature(payload: any): string {
    const payloadString = JSON.stringify(payload);
    const secret = this.getSigningSecret();

    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Verify token signature
   */
  private verifySignature(payload: any, signature: string): boolean {
    const expectedSignature = this.createSignature(payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Encode token (payload + signature)
   */
  private encodeToken(payload: any, signature: string): string {
    const payloadString = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signatureString = Buffer.from(signature).toString('base64url');
    return `${payloadString}.${signatureString}`;
  }

  /**
   * Decode token (payload + signature)
   */
  private decodeToken(token: string): { payload: any; signature: string } {
    const [payloadString, signatureString] = token.split('.');

    if (!payloadString || !signatureString) {
      throw new Error('Invalid token format');
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadString, 'base64url').toString());
      const signature = Buffer.from(signatureString, 'base64url').toString('hex');

      return { payload, signature };
    } catch (error) {
      throw new Error('Failed to decode token');
    }
  }

  /**
   * Get signing secret
   */
  private getSigningSecret(): string {
    const secret = process.env.TOKEN_SIGNING_SECRET;
    if (!secret) {
      throw new Error('TOKEN_SIGNING_SECRET environment variable is not set');
    }
    return secret;
  }

  /**
   * Cache token metadata
   */
  private async cacheToken(token: string, payload: any): Promise<void> {
    const cacheKey = `token:${this.getTokenId(token)}`;
    const cacheData = {
      type: payload.type,
      email: payload.email,
      tenantId: payload.tenantId,
      userId: payload.userId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt
    };

    // Cache for 24 hours or until token expires
    const ttl = Math.min(24 * 60 * 60, Math.floor((payload.expiresAt - Date.now()) / 1000));
    await this.cache.set(cacheKey, JSON.stringify(cacheData), ttl);
  }

  /**
   * Check if token has been revoked
   */
  private async isTokenRevoked(token: string): Promise<boolean> {
    const revoked = await this.cache.get(`revoked:${token}`);
    return revoked === 'true';
  }

  /**
   * Clean up expired tokens from cache
   */
  async cleanupExpiredTokens(): Promise<number> {
    // This would be implemented by the cache system automatically
    // For now, just log that cleanup was requested
    this.logger.info('Token cleanup requested');
    return 0;
  }

  /**
   * Generate secure random string
   */
  generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash data securely
   */
  async hashData(data: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512')
      .toString('hex');

    return { hash, salt: actualSalt };
  }

  /**
   * Verify data hash
   */
  async verifyHash(data: string, hash: string, salt: string): Promise<boolean> {
    const expectedHash = crypto
      .pbkdf2Sync(data, salt, 10000, 64, 'sha512')
      .toString('hex');

    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  }
}