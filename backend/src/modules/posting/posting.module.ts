import { Module } from '@nestjs/common';
import { PostingService } from './posting.service';

@Module({
  providers: [PostingService],
  exports: [PostingService],
})
export class PostingModule {}
