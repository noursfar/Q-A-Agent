import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export function createRedisClient(configService: ConfigService): Redis {
  const url =
    configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}
