import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDto } from './dto';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from 'prisma/prisma-client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable({})
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}
  async login(dto: AuthDto) {
    const foundUser =
      await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },
      });

    if (!foundUser)
      throw new ForbiddenException(
        'INVALID_USERNAME',
        {
          cause: 'Invalid credentials',
        },
      );

    const pwMatches = await argon.verify(
      foundUser?.password,
      dto.password,
    );

    if (!pwMatches)
      throw new ForbiddenException(
        'INVALID_PASSWORD',
        {
          cause: 'Invalid credentials',
        },
      );

    const access_token = await this.signToken(
      foundUser.id,
      foundUser.email,
    );

    return {
      access_token,
    };
  }

  async signup(dto: AuthDto) {
    try {
      const passwordHash = await argon.hash(
        dto.password,
      );

      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          password: passwordHash,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      const access_token = await this.signToken(
        user.id,
        user.email,
      );
      return {
        access_token,
      };
    } catch (error) {
      if (
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ForbiddenException(
          'Email already exists',
        );
      }
      throw error;
    }
  }

  signToken(
    userId: string,
    email: string,
  ): Promise<string> {
    return this.jwt.signAsync(
      {
        sub: userId,
        email,
      },
      {
        expiresIn: '15m',
        secret: this.config.get('JWT_SECRET'),
      },
    );
  }
}
