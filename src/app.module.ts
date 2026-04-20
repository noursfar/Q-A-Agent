import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { validate } from './common/env.validation.js';
import { winstonConfig } from './common/logger/winston.config.js';
import { IngestionModule } from './modules/ingestion/ingestion.module.js';
import { RetrievalModule } from './modules/retrieval/retrieval.module.js';
import { ChatModule } from './modules/chat/chat.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        winstonConfig(configService),
    }),
    IngestionModule,
    RetrievalModule,
    ChatModule,
  ],
})
export class AppModule {}
