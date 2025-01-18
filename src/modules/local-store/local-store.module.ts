import { Module } from '@nestjs/common';
import { LocalStoreService } from './local-store.service';
import { LocalStore } from './repository/local-store';
import { LocalStoreController } from './local-store.controller';

@Module({
  imports: [],
  controllers: [LocalStoreController],
  providers: [LocalStoreService, LocalStore],
})
export class LocalStoreModule {}
