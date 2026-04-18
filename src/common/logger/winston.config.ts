import { ConfigService } from '@nestjs/config';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import { format, transports } from 'winston';

/**
 * Winston configuration factory.
 * Consumed by WinstonModule.forRootAsync() in AppModule.
 *
 * Development  → colored, human-readable nestLike format
 * Production   → structured JSON (machine-parseable for ELK / CloudWatch)
 *
 * Log level is controlled via the LOG_LEVEL env var (default: 'info').
 */
export function winstonConfig(configService: ConfigService) {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const logLevel = configService.get<string>('LOG_LEVEL') ?? 'info';

  return {
    level: logLevel,
    transports: [
      new transports.Console({
        format: isProduction
          ? // --- Production: JSON ------------------------------------------------
            format.combine(format.timestamp(), format.ms(), format.json())
          : // --- Development: colored nestLike -----------------------------------
            format.combine(
              format.timestamp({ format: 'HH:mm:ss' }),
              format.ms(),
              nestWinstonModuleUtilities.format.nestLike('Q-A-Agent', {
                colors: true,
                prettyPrint: true,
              }),
            ),
      }),
    ],
  };
}
