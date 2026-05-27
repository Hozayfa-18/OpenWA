# Conversation Contact Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display a real phone number and contact name in the conversation inbox by denormalizing `phoneNumber` and `contactName` onto the `conversations` row at write time.

**Architecture:** Two nullable columns (`phoneNumber`, `contactName`) are added to `conversations` and populated from two sources: (1) at message-receive time from the WA `chatId`/`from` field when it's in the phone-number-bearing `@c.us` format, and (2) when a CRM contact is linked to a conversation, copying name and phone from `crm_contacts`. Contact name changes propagate to linked conversations via the upsert path.

**Tech Stack:** NestJS (TypeORM migrations, entities, services, controllers), BullMQ (queue processor), React + TanStack Query (frontend)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/modules/conversations/utils/phone.ts` | Create | Pure `extractPhoneNumber` utility |
| `src/modules/conversations/utils/phone.spec.ts` | Create | Unit tests for above |
| `src/database/migrations/1779235200004-AddConversationContactFields.ts` | Create | DB migration: add `phoneNumber`, `contactName` columns |
| `src/modules/conversations/entities/conversation.entity.ts` | Modify | Add two nullable columns |
| `src/modules/queue/processors/conversation-update.processor.ts` | Modify | Add `from?` to job interface; set `phoneNumber` on INSERT |
| `src/modules/message/message.service.ts` | Modify | Pass `from`/`to` in job data; set `phoneNumber` on INSERT in fallback path |
| `src/modules/session/session.service.ts` | Modify | Pass `msg.from` in job data; set `phoneNumber` on INSERT in fallback path |
| `src/modules/conversations/dto/link-contact.dto.ts` | Create | `{ contactId: string }` DTO |
| `src/modules/conversations/repositories/conversation.repository.ts` | Modify | Add `linkContact` method |
| `src/modules/conversations/services/conversations.service.ts` | Modify | Add `linkContact` method |
| `src/modules/conversations/conversations.controller.ts` | Modify | Add `PATCH /:sessionId/:chatId/contact` |
| `src/modules/conversations/conversations.module.ts` | Modify | Import `Contact` entity |
| `src/modules/crm/services/crm-contacts.service.ts` | Modify | After upsert, propagate name changes to linked conversations |
| `src/modules/crm/crm.module.ts` | Modify | Import `Conversation` entity |
| `dashboard/src/services/api.ts` | Modify | Add `phoneNumber`, `contactName` to `Conversation` type; add `linkContact` API method |
| `dashboard/src/pages/Conversations.tsx` | Modify | Display `contactName` → `phoneNumber` → fallback |

---

## Task 1: Phone Extraction Utility

**Files:**
- Create: `src/modules/conversations/utils/phone.ts`
- Create: `src/modules/conversations/utils/phone.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/conversations/utils/phone.spec.ts
import { extractPhoneNumber } from './phone';

describe('extractPhoneNumber', () => {
  it('extracts number from @c.us chatId', () => {
    expect(extractPhoneNumber('201234567890@c.us')).toBe('201234567890');
  });

  it('returns null for @lid chatId', () => {
    expect(extractPhoneNumber('20255233581184@lid')).toBeNull();
  });

  it('returns null for group @g.us chatId', () => {
    expect(extractPhoneNumber('120363000000000001@g.us')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractPhoneNumber('')).toBeNull();
  });

  it('returns null for plain string with no @ suffix', () => {
    expect(extractPhoneNumber('something')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd openwa && pnpm test -- --testPathPattern=phone.spec --no-coverage
```
Expected: FAIL — `Cannot find module './phone'`

- [ ] **Step 3: Write the implementation**

```ts
// src/modules/conversations/utils/phone.ts
export const extractPhoneNumber = (waId: string): string | null => {
  if (waId.endsWith('@c.us')) {
    return waId.slice(0, waId.lastIndexOf('@'));
  }
  return null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd openwa && pnpm test -- --testPathPattern=phone.spec --no-coverage
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add openwa/src/modules/conversations/utils/phone.ts openwa/src/modules/conversations/utils/phone.spec.ts
git commit -m "feat: add extractPhoneNumber utility for WA @c.us chatIds"
```

---

## Task 2: DB Migration

**Files:**
- Create: `src/database/migrations/1779235200004-AddConversationContactFields.ts`

- [ ] **Step 1: Create the migration file**

```ts
// src/database/migrations/1779235200004-AddConversationContactFields.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationContactFields1779235200004 implements MigrationInterface {
  name = 'AddConversationContactFields1779235200004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conversations"
        ADD COLUMN IF NOT EXISTS "phoneNumber" VARCHAR,
        ADD COLUMN IF NOT EXISTS "contactName" VARCHAR
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN IF EXISTS "contactName"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN IF EXISTS "phoneNumber"`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add openwa/src/database/migrations/1779235200004-AddConversationContactFields.ts
git commit -m "feat: migration — add phoneNumber and contactName to conversations"
```

---

## Task 3: Update Conversation Entity

**Files:**
- Modify: `src/modules/conversations/entities/conversation.entity.ts`

- [ ] **Step 1: Add the two columns to the entity**

Replace the entity file content with:

```ts
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('conversations')
@Index(['tenantId', 'lastMessageAt'])
@Index(['tenantId', 'assignedUserId'])
export class Conversation {
  @PrimaryColumn({ type: 'varchar' })
  tenantId: string;

  @PrimaryColumn({ type: 'varchar' })
  sessionId: string;

  @PrimaryColumn({ type: 'varchar' })
  chatId: string;

  @Column({ nullable: true, type: 'varchar' })
  contactId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  assignedUserId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  phoneNumber: string | null;

  @Column({ nullable: true, type: 'varchar' })
  contactName: string | null;

  @Column({ type: 'varchar' })
  lastMessageId: string;

  @Column({ type: 'timestamp' })
  lastMessageAt: Date;

  @Column({ default: 0 })
  unreadCount: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add openwa/src/modules/conversations/entities/conversation.entity.ts
git commit -m "feat: add phoneNumber and contactName columns to Conversation entity"
```

---

## Task 4: Enrich Job Data with `from` Field

The `ConversationUpdateJobData` interface is shared by the queue processor and two fallback paths. Add `from?: string` so all write paths can extract the phone number from it.

**Files:**
- Modify: `src/modules/queue/processors/conversation-update.processor.ts` (interface only in this task)
- Modify: `src/modules/message/message.service.ts` (populate `from` in job data)
- Modify: `src/modules/session/session.service.ts` (populate `from` in job data)

- [ ] **Step 1: Add `from?` to the interface in the processor file**

In `src/modules/queue/processors/conversation-update.processor.ts`, update the interface:

```ts
export interface ConversationUpdateJobData {
  tenantId: string;
  sessionId: string;
  chatId: string;
  messageId: string;
  messageAt: number;
  direction: 'incoming' | 'outgoing';
  from?: string;
}
```

- [ ] **Step 2: Populate `from` in `MessageService.enqueueConversationUpdate`**

In `src/modules/message/message.service.ts`, find the `enqueueConversationUpdate` private method and update the `jobData` construction:

```ts
private async enqueueConversationUpdate(message: Message): Promise<void> {
  if (!message.tenantId) return;

  const jobData: ConversationUpdateJobData = {
    tenantId: message.tenantId,
    sessionId: message.sessionId,
    chatId: message.chatId,
    messageId: message.waMessageId ?? message.id,
    messageAt: this.toUnixSeconds(message.timestamp ?? Date.now()),
    direction: 'outgoing',
    from: message.from,
  };

  if (this.conversationUpdateQueue) {
    await this.conversationUpdateQueue.add('update', jobData);
  } else {
    await this.applyConversationUpdate(jobData);
  }
}
```

- [ ] **Step 3: Populate `from` in `SessionService` job data construction**

In `src/modules/session/session.service.ts`, find the `jobData` construction block (around line 351) and add `from`:

```ts
const jobData: ConversationUpdateJobData = {
  tenantId: session.tenantId,
  sessionId: id,
  chatId: msg.chatId,
  messageId: msg.id ?? '',
  messageAt: msg.timestamp ?? Math.floor(Date.now() / 1000),
  direction: direction === MessageDirection.OUTGOING ? 'outgoing' : 'incoming',
  from: msg.from ?? msg.chatId,
};
```

- [ ] **Step 4: Commit**

```bash
git add openwa/src/modules/queue/processors/conversation-update.processor.ts
git add openwa/src/modules/message/message.service.ts
git add openwa/src/modules/session/session.service.ts
git commit -m "feat: thread from field through ConversationUpdateJobData"
```

---

## Task 5: Populate `phoneNumber` on Conversation Create (All 3 Write Paths)

The `phoneNumber` is extracted and stored only on INSERT (new conversation). UPDATEs leave it untouched — the CASE expression already guards `lastMessageAt` and we add a similar guard for `phoneNumber`.

**Files:**
- Modify: `src/modules/queue/processors/conversation-update.processor.ts`
- Modify: `src/modules/message/message.service.ts`
- Modify: `src/modules/session/session.service.ts`

All three have an identical `INSERT … catch UPDATE` pattern. Apply the same change to each.

- [ ] **Step 1: Update `ConversationUpdateProcessor.createOrUpdateConversation`**

In `src/modules/queue/processors/conversation-update.processor.ts`, add the import and update `createOrUpdateConversation`:

```ts
import { extractPhoneNumber } from '../../conversations/utils/phone';
```

Update the private method signature and INSERT:

```ts
private async createOrUpdateConversation(data: {
  tenantId: string;
  sessionId: string;
  chatId: string;
  messageId: string;
  lastMessageAt: Date;
  direction: 'incoming' | 'outgoing';
  from?: string;
}): Promise<boolean> {
  const where = {
    tenantId: data.tenantId,
    sessionId: data.sessionId,
    chatId: data.chatId,
  } as FindOptionsWhere<Conversation>;

  const phoneNumber =
    extractPhoneNumber(data.chatId) ??
    extractPhoneNumber(data.from ?? '') ??
    null;

  try {
    await this.repo.insert({
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      chatId: data.chatId,
      contactId: null,
      assignedUserId: null,
      phoneNumber,
      contactName: null,
      lastMessageId: data.messageId,
      lastMessageAt: data.lastMessageAt,
      unreadCount: data.direction === 'incoming' ? 1 : 0,
    });
    return true;
  } catch {
    await this.repo
      .createQueryBuilder()
      .update(Conversation)
      .set({
        lastMessageId: () =>
          `CASE WHEN "lastMessageAt" <= :lastMessageAt THEN :lastMessageId ELSE "lastMessageId" END`,
        lastMessageAt: () =>
          `CASE WHEN "lastMessageAt" <= :lastMessageAt THEN :lastMessageAt ELSE "lastMessageAt" END`,
        unreadCount: () => (data.direction === 'incoming' ? '"unreadCount" + 1' : '"unreadCount"'),
      })
      .where(where)
      .setParameters({ lastMessageId: data.messageId, lastMessageAt: data.lastMessageAt })
      .execute();
    return false;
  }
}
```

Also update the `process` method to pass `from`:

```ts
async process(job: Job<ConversationUpdateJobData>): Promise<void> {
  const { tenantId, sessionId, chatId, messageId, messageAt, direction, from } = job.data;
  const lastMessageAt = new Date(messageAt * 1000);
  const wasCreated = await this.createOrUpdateConversation({
    tenantId,
    sessionId,
    chatId,
    messageId,
    lastMessageAt,
    direction,
    from,
  });
  // … rest unchanged
}
```

- [ ] **Step 2: Update `MessageService.applyConversationUpdate`**

In `src/modules/message/message.service.ts`, add the import at the top:

```ts
import { extractPhoneNumber } from '../conversations/utils/phone';
```

Update `applyConversationUpdate`:

```ts
private async applyConversationUpdate(data: ConversationUpdateJobData): Promise<void> {
  const lastMessageAt = new Date(data.messageAt * 1000);
  const phoneNumber =
    extractPhoneNumber(data.chatId) ??
    extractPhoneNumber(data.from ?? '') ??
    null;

  try {
    await this.conversationRepository.insert({
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      chatId: data.chatId,
      contactId: null,
      assignedUserId: null,
      phoneNumber,
      contactName: null,
      lastMessageId: data.messageId,
      lastMessageAt,
      unreadCount: data.direction === 'incoming' ? 1 : 0,
    });
    this.eventsGateway.emitConversationNew(data.tenantId, {
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      chatId: data.chatId,
    });
    return;
  } catch {
    await this.conversationRepository
      .createQueryBuilder()
      .update(Conversation)
      .set({
        lastMessageId: () =>
          `CASE WHEN "lastMessageAt" <= :lastMessageAt THEN :lastMessageId ELSE "lastMessageId" END`,
        lastMessageAt: () =>
          `CASE WHEN "lastMessageAt" <= :lastMessageAt THEN :lastMessageAt ELSE "lastMessageAt" END`,
        unreadCount: () => (data.direction === 'incoming' ? '"unreadCount" + 1' : '"unreadCount"'),
      })
      .where({
        tenantId: data.tenantId,
        sessionId: data.sessionId,
        chatId: data.chatId,
      })
      .setParameters({ lastMessageId: data.messageId, lastMessageAt })
      .execute();
    this.eventsGateway.emitConversationUpdated(data.tenantId, {
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      chatId: data.chatId,
    });
  }
}
```

- [ ] **Step 3: Update `SessionService.applyConversationUpdate`**

In `src/modules/session/session.service.ts`, add the import:

```ts
import { extractPhoneNumber } from '../conversations/utils/phone';
```

Update `applyConversationUpdate` (same pattern as step 2):

```ts
private async applyConversationUpdate(data: ConversationUpdateJobData): Promise<void> {
  const lastMessageAt = new Date(data.messageAt * 1000);
  const phoneNumber =
    extractPhoneNumber(data.chatId) ??
    extractPhoneNumber(data.from ?? '') ??
    null;

  try {
    await this.conversationRepository.insert({
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      chatId: data.chatId,
      contactId: null,
      assignedUserId: null,
      phoneNumber,
      contactName: null,
      lastMessageId: data.messageId,
      lastMessageAt,
      unreadCount: data.direction === 'incoming' ? 1 : 0,
    });
    this.eventsGateway.emitConversationNew(data.tenantId, {
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      chatId: data.chatId,
    });
    return;
  } catch {
    await this.conversationRepository
      .createQueryBuilder()
      .update(Conversation)
      .set({
        lastMessageId: () =>
          `CASE WHEN "lastMessageAt" <= :lastMessageAt THEN :lastMessageId ELSE "lastMessageId" END`,
        lastMessageAt: () =>
          `CASE WHEN "lastMessageAt" <= :lastMessageAt THEN :lastMessageAt ELSE "lastMessageAt" END`,
        unreadCount: () => (data.direction === 'incoming' ? '"unreadCount" + 1' : '"unreadCount"'),
      })
      .where({
        tenantId: data.tenantId,
        sessionId: data.sessionId,
        chatId: data.chatId,
      })
      .setParameters({ lastMessageId: data.messageId, lastMessageAt })
      .execute();
    this.eventsGateway.emitConversationUpdated(data.tenantId, {
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      chatId: data.chatId,
    });
  }
}
```

- [ ] **Step 4: Run the existing test suite to confirm no regressions**

```bash
cd openwa && pnpm test -- --no-coverage
```

Expected: all existing tests pass

- [ ] **Step 5: Commit**

```bash
git add openwa/src/modules/queue/processors/conversation-update.processor.ts
git add openwa/src/modules/message/message.service.ts
git add openwa/src/modules/session/session.service.ts
git commit -m "feat: populate phoneNumber on conversation create from WA chatId"
```

---

## Task 6: Link Contact Endpoint

When an agent links a CRM contact to a conversation, the `contactId`, `contactName`, and `phoneNumber` are all written to the conversation row.

**Files:**
- Create: `src/modules/conversations/dto/link-contact.dto.ts`
- Modify: `src/modules/conversations/repositories/conversation.repository.ts`
- Modify: `src/modules/conversations/services/conversations.service.ts`
- Modify: `src/modules/conversations/conversations.controller.ts`
- Modify: `src/modules/conversations/conversations.module.ts`

- [ ] **Step 1: Create the DTO**

```ts
// src/modules/conversations/dto/link-contact.dto.ts
import { IsString, IsUUID } from 'class-validator';

export class LinkContactDto {
  @IsString()
  @IsUUID()
  contactId: string;
}
```

- [ ] **Step 2: Add `linkContact` to the repository**

In `src/modules/conversations/repositories/conversation.repository.ts`, add:

```ts
async linkContact(
  sessionId: string,
  chatId: string,
  contactId: string,
  contactName: string,
  phoneNumber: string | null,
): Promise<void> {
  await this.repo.update(
    { tenantId: this.tenantId, sessionId, chatId } as FindOptionsWhere<Conversation>,
    { contactId, contactName, phoneNumber },
  );
}
```

- [ ] **Step 3: Add `linkContact` to the service**

In `src/modules/conversations/services/conversations.service.ts`, inject the Contact repository and add the method.

Replace the full file:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssignConversationDto } from '../dto/assign-conversation.dto';
import { LinkContactDto } from '../dto/link-contact.dto';
import { ListConversationsDto } from '../dto/list-conversations.dto';
import { Conversation } from '../entities/conversation.entity';
import { ConversationRepository } from '../repositories/conversation.repository';
import { EventsGateway } from '../../events/events.gateway';
import { Contact } from '../../crm/entities/contact.entity';
import { extractPhoneNumber } from '../utils/phone';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly repo: ConversationRepository,
    private readonly eventsGateway: EventsGateway,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
  ) {}

  findAll(dto: ListConversationsDto): Promise<Conversation[]> {
    return this.repo.findAll(dto);
  }

  async assign(sessionId: string, chatId: string, dto: AssignConversationDto): Promise<void> {
    const conversation = await this.repo.findByChat(sessionId, chatId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${chatId} not found`);
    }

    await this.repo.updateByChat(sessionId, chatId, { assignedUserId: dto.userId });
    this.eventsGateway.emitConversationAssigned(conversation.tenantId, {
      tenantId: conversation.tenantId,
      sessionId: conversation.sessionId,
      chatId,
      assignedUserId: dto.userId,
    });
  }

  async linkContact(sessionId: string, chatId: string, dto: LinkContactDto): Promise<void> {
    const conversation = await this.repo.findByChat(sessionId, chatId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${chatId} not found`);
    }

    const contact = await this.contactRepo.findOneBy({
      id: dto.contactId,
      tenantId: conversation.tenantId,
    });
    if (!contact) {
      throw new NotFoundException(`Contact ${dto.contactId} not found`);
    }

    const waEntry = contact.contactData.find(e => e.chatType === 'whatsapp');
    const phoneNumber = waEntry ? (extractPhoneNumber(waEntry.chatId) ?? null) : null;

    await this.repo.linkContact(sessionId, chatId, contact.id, contact.name, phoneNumber);
  }

  async markRead(sessionId: string, chatId: string): Promise<void> {
    const conversation = await this.repo.findByChat(sessionId, chatId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${chatId} not found`);
    }

    await this.repo.updateByChat(sessionId, chatId, { unreadCount: 0 });
  }
}
```

- [ ] **Step 4: Add the endpoint to the controller**

In `src/modules/conversations/conversations.controller.ts`, add the import and endpoint:

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { Message } from '../message/entities/message.entity';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { LinkContactDto } from './dto/link-contact.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { ConversationsService } from './services/conversations.service';

@Controller('v1/conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly ctx: TenantContext,
  ) {}

  @Get()
  list(@Query() dto: ListConversationsDto) {
    return this.conversationsService.findAll(dto);
  }

  @Get(':sessionId/:chatId/messages')
  messages(@Param('sessionId') sessionId: string, @Param('chatId') chatId: string): Promise<Message[]> {
    return this.messageRepository.find({
      where: { sessionId, chatId, tenantId: this.ctx.tenantId } as FindOptionsWhere<Message>,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  @Patch(':sessionId/:chatId/assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(ApiKeyRole.OPERATOR)
  async assign(
    @Param('sessionId') sessionId: string,
    @Param('chatId') chatId: string,
    @Body() dto: AssignConversationDto,
  ): Promise<void> {
    await this.conversationsService.assign(sessionId, chatId, dto);
  }

  @Patch(':sessionId/:chatId/contact')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(ApiKeyRole.OPERATOR)
  async linkContact(
    @Param('sessionId') sessionId: string,
    @Param('chatId') chatId: string,
    @Body() dto: LinkContactDto,
  ): Promise<void> {
    await this.conversationsService.linkContact(sessionId, chatId, dto);
  }

  @Patch(':sessionId/:chatId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(ApiKeyRole.OPERATOR)
  async markRead(@Param('sessionId') sessionId: string, @Param('chatId') chatId: string): Promise<void> {
    await this.conversationsService.markRead(sessionId, chatId);
  }
}
```

- [ ] **Step 5: Update the module to import the Contact entity**

Replace `src/modules/conversations/conversations.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../../common/tenant/tenant.module';
import { Contact } from '../crm/entities/contact.entity';
import { Message } from '../message/entities/message.entity';
import { ConversationsController } from './conversations.controller';
import { Conversation } from './entities/conversation.entity';
import { ConversationRepository } from './repositories/conversation.repository';
import { ConversationsService } from './services/conversations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, Contact]), TenantModule],
  providers: [ConversationRepository, ConversationsService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
```

- [ ] **Step 6: Run tests to confirm no regressions**

```bash
cd openwa && pnpm test -- --no-coverage
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add openwa/src/modules/conversations/dto/link-contact.dto.ts
git add openwa/src/modules/conversations/repositories/conversation.repository.ts
git add openwa/src/modules/conversations/services/conversations.service.ts
git add openwa/src/modules/conversations/conversations.controller.ts
git add openwa/src/modules/conversations/conversations.module.ts
git commit -m "feat: add link-contact endpoint — writes contactId, contactName, phoneNumber to conversation"
```

---

## Task 7: Propagate Contact Name Changes

When a CRM contact is upserted (name changed), all conversations linked to that contact get their `contactName` updated.

**Files:**
- Modify: `src/modules/crm/services/crm-contacts.service.ts`
- Modify: `src/modules/crm/crm.module.ts`

- [ ] **Step 1: Update `CrmContactsService` to accept and inject the Conversation repository**

Replace `src/modules/crm/services/crm-contacts.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { UpsertContactItemDto } from '../dto/upsert-contacts.dto';
import { Contact, ContactChatType } from '../entities/contact.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { extractPhoneNumber } from '../../conversations/utils/phone';

@Injectable()
export class CrmContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly repo: Repository<Contact>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    private readonly ctx: TenantContext,
  ) {}

  findAll(): Promise<Contact[]> {
    return this.repo.findBy({ tenantId: this.ctx.tenantId });
  }

  async upsert(items: UpsertContactItemDto[]): Promise<{ upserted: number }> {
    return this.upsertForTenant(this.ctx.tenantId, items);
  }

  async upsertForTenant(tenantId: string, items: UpsertContactItemDto[]): Promise<{ upserted: number }> {
    if (items.length === 0) {
      return { upserted: 0 };
    }

    await this.repo.upsert(
      items.map(item => ({
        id: item.id,
        tenantId,
        name: item.name,
        responsibleUserId: item.responsibleUserId ?? null,
        contactData: item.contactData,
        uri: item.uri ?? null,
      })),
      { conflictPaths: ['tenantId', 'id'], skipUpdateIfNoValuesChanged: true },
    );

    // Propagate name and phone changes to all conversations linked to these contacts
    for (const item of items) {
      const waEntry = item.contactData?.find(e => e.chatType === 'whatsapp');
      const phoneNumber = waEntry ? (extractPhoneNumber(waEntry.chatId) ?? null) : null;

      await this.conversationRepo.update(
        { tenantId, contactId: item.id },
        { contactName: item.name, ...(phoneNumber !== null ? { phoneNumber } : {}) },
      );
    }

    return { upserted: items.length };
  }

  async findByChatId(chatType: string, chatId: string): Promise<Contact | null> {
    const contacts = await this.repo.find({ where: { tenantId: this.ctx.tenantId } });

    return (
      contacts.find(contact =>
        contact.contactData.some(entry => entry.chatType === chatType && entry.chatId === chatId),
      ) ?? null
    );
  }
}

export type { ContactChatType };
```

- [ ] **Step 2: Update `CrmModule` to import `Conversation` entity**

Replace `src/modules/crm/crm.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookModule } from '../webhook/webhook.module';
import { CrmInboundWebhookController } from './controllers/crm-inbound-webhook.controller';
import { CrmSyncController } from './controllers/crm-sync.controller';
import { Contact } from './entities/contact.entity';
import { CrmUser } from './entities/crm-user.entity';
import { Deal } from './entities/deal.entity';
import { CrmAuthGuard } from './guards/crm-auth.guard';
import { CrmContactsService } from './services/crm-contacts.service';
import { CrmDealsService } from './services/crm-deals.service';
import { CrmOutboundService } from './services/crm-outbound.service';
import { CrmUsersService } from './services/crm-users.service';
import { Conversation } from '../conversations/entities/conversation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, Deal, CrmUser, Conversation]),
    WebhookModule,
  ],
  controllers: [CrmSyncController, CrmInboundWebhookController],
  providers: [CrmAuthGuard, CrmContactsService, CrmDealsService, CrmUsersService, CrmOutboundService],
  exports: [CrmContactsService, CrmDealsService, CrmUsersService, CrmOutboundService],
})
export class CrmModule {}
```

- [ ] **Step 3: Run tests**

```bash
cd openwa && pnpm test -- --no-coverage
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add openwa/src/modules/crm/services/crm-contacts.service.ts
git add openwa/src/modules/crm/crm.module.ts
git commit -m "feat: propagate contact name/phone changes to linked conversations on upsert"
```

---

## Task 8: Frontend — Type Update and Display

**Files:**
- Modify: `dashboard/src/services/api.ts`
- Modify: `dashboard/src/pages/Conversations.tsx`

- [ ] **Step 1: Update `Conversation` type and add `linkContact` API method**

In `dashboard/src/services/api.ts`, update the `Conversation` interface:

```ts
export interface Conversation {
  tenantId: string;
  sessionId: string;
  chatId: string;
  contactId: string | null;
  assignedUserId: string | null;
  phoneNumber: string | null;
  contactName: string | null;
  lastMessageId: string;
  lastMessageAt: string;
  unreadCount: number;
}
```

In the `conversationApi` object, add:

```ts
linkContact: (sessionId: string, chatId: string, contactId: string) =>
  request<void>(`/v1/conversations/${encodeURIComponent(sessionId)}/${encodeURIComponent(chatId)}/contact`, {
    method: 'PATCH',
    body: JSON.stringify({ contactId }),
  }),
```

- [ ] **Step 2: Update conversation display in `Conversations.tsx`**

The `formatChatId` helper that was previously stripping `@lid` was wrong — `@lid` IDs aren't phone numbers. Replace the entire display logic.

In `dashboard/src/pages/Conversations.tsx`, remove the `formatChatId` function and replace it with `displayName`:

```ts
const displayName = (conversation: Conversation): string =>
  conversation.contactName ?? conversation.phoneNumber ?? conversation.chatId;
```

Update the `ConversationRow` to use `displayName`:

```tsx
<span className="conversation-chat-id">{displayName(conversation)}</span>
```

Update the thread header to show name, phone, and session as subtitle:

```tsx
<header className="thread-header">
  <div className="thread-title">
    <strong>{selectedConversation.contactName ?? selectedConversation.phoneNumber ?? selectedConversation.chatId}</strong>
    {selectedConversation.contactName && selectedConversation.phoneNumber && (
      <span className="thread-subtitle">{selectedConversation.phoneNumber}</span>
    )}
    <span className="thread-subtitle">{selectedConversation.sessionId}</span>
    {selectedConversation.assignedUserId && (
      <span>
        <UserCheck size={14} />
        {selectedConversation.assignedUserId}
      </span>
    )}
  </div>
  {/* … buttons unchanged … */}
</header>
```

- [ ] **Step 3: Commit**

```bash
git add openwa/dashboard/src/services/api.ts
git add openwa/dashboard/src/pages/Conversations.tsx
git commit -m "feat: display contactName and phoneNumber in conversation inbox"
```

---

## Self-Review

**Spec coverage:**
- ✅ `phoneNumber` column added to DB + entity
- ✅ `contactName` column added to DB + entity
- ✅ Phone extracted from `@c.us` chatId at write time (all 3 paths)
- ✅ `@lid` chatIds produce `null` phone (not displayed)
- ✅ Contact linked via `PATCH /contact` → copies name + phone from CRM
- ✅ CRM contact upsert propagates name changes to linked conversations
- ✅ Frontend shows name → phone → raw chatId (priority order)
- ✅ `linkContact` API method added to frontend service

**Placeholder scan:** None found — all steps contain complete code.

**Type consistency:**
- `linkContact` in repo takes `(sessionId, chatId, contactId, contactName, phoneNumber)` — matches call in service ✅
- `displayName` helper uses `contactName`, `phoneNumber`, `chatId` — all present on `Conversation` type ✅
- `extractPhoneNumber` import path is consistent across all files ✅
