'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import type { ChatAction, ContentBlock } from '@/types/chat';
import type { SchemeMatch } from '@/types/scheme';
import type { CitizenDocument } from '@/types/document';
import { Button, Card, CardBody } from '@/components/ui';
import { SchemeCard } from '@/components/cards/scheme-card';
import { DocumentCard } from '@/components/cards/document-card';
import { ComplaintDraftCard } from '@/components/cards/complaint-card';
import {
  DigiLockerList,
  EmailReceiptCard,
  PassbookCard,
  TrainList,
} from '@/components/cards/service-cards';
import { ApplicationCard, ReviewCard, TaskProgressCard } from '@/components/cards/task-cards';
import { RequirementsCard } from '@/components/cards/requirements-card';
import {
  DocumentOptionsCard,
  DocumentPickerCard,
  OtpCard,
  ProfileConfirmCard,
  TextInputCard,
} from '@/components/cards/resolution-cards';
import {
  ChecklistCard,
  DownloadRow,
  ExplainCard,
  NoticeCard,
  NotificationItem,
  WhyCard,
} from '@/components/cards/misc-cards';

/** Maps a structured content block to the component that renders it. */
export function BlockRenderer({
  block,
  onAction,
  busy,
}: {
  block: ContentBlock;
  onAction?: (action: ChatAction) => void;
  busy?: boolean;
}) {
  switch (block.type) {
    case 'notice':
      return (
        <NoticeCard tone={block.tone} title={block.title} body={block.body} source={block.source} />
      );
    case 'checklist':
      return <ChecklistCard title={block.title} items={block.items} />;
    case 'schemes':
      return <SchemeResults matches={block.matches} onAction={onAction} />;
    case 'scheme_detail':
      return <SchemeCard match={block.match} onAction={onAction} defaultExpanded />;
    case 'pf_passbook':
      return <PassbookCard passbook={block.passbook} source={block.source} />;
    case 'documents':
      return block.compact ? (
        <DocumentTickList documents={block.documents} title={block.title} />
      ) : (
        <div className="space-y-3">
          {block.title ? (
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {block.title}
            </h3>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {block.documents.map((document) => (
              <DocumentCard key={document.id} document={document} />
            ))}
          </div>
        </div>
      );
    case 'digilocker':
      return <DigiLockerList documents={block.documents} onAction={onAction} />;
    case 'review':
      return (
        <ReviewCard
          title={block.title}
          rows={block.rows}
          warning={block.warning}
          confirm={block.confirm}
          cancel={block.cancel}
          onAction={onAction}
          busy={busy}
        />
      );
    case 'task_progress':
      return <TaskProgressCard task={block.task} steps={block.steps} onAction={onAction} />;
    case 'applications':
      return (
        <div className="space-y-3">
          {block.applications.map((application) => (
            <ApplicationCard key={application.taskId} application={application} />
          ))}
        </div>
      );
    case 'trains':
      return (
        <TrainList
          options={block.options}
          summary={block.summary}
          taskId={block.taskId}
          onAction={onAction}
        />
      );
    case 'complaint_draft':
      return <ComplaintDraftCard complaint={block.complaint} onAction={onAction} busy={busy} />;
    case 'email_sent':
      return <EmailReceiptCard receipt={block.receipt} />;
    case 'downloads':
      return (
        <div className="space-y-3">
          {block.files.map((file) => (
            <DownloadRow key={file.id} file={file} />
          ))}
        </div>
      );
    case 'notifications':
      return (
        <div className="space-y-3">
          {block.items.slice(0, 5).map((item) => (
            <NotificationItem key={item.id} notification={item} />
          ))}
        </div>
      );
    case 'explain':
      return <ExplainCard term={block.term} meaning={block.meaning} example={block.example} />;
    case 'why':
      return <WhyCard title={block.title} reasons={block.reasons} />;
    case 'requirements':
      return <RequirementsCard taskId={block.taskId} title={block.title} onAction={onAction} />;
    case 'document_options':
      return (
        <DocumentOptionsCard
          documentKey={block.documentKey}
          label={block.label}
          why={block.why}
          parentTaskId={block.parentTaskId}
          options={block.options}
          onAction={onAction}
          busy={busy}
        />
      );
    case 'document_picker':
      return (
        <DocumentPickerCard
          childTaskId={block.childTaskId}
          label={block.label}
          candidates={block.candidates}
          locker={block.locker}
          onAction={onAction}
          busy={busy}
        />
      );
    case 'profile_confirm':
      return (
        <ProfileConfirmCard
          childTaskId={block.childTaskId}
          rows={block.rows}
          onAction={onAction}
          busy={busy}
        />
      );
    case 'text_input':
      return (
        <TextInputCard
          childTaskId={block.childTaskId}
          action={block.action}
          field={block.field}
          label={block.label}
          placeholder={block.placeholder}
          help={block.help}
          current={block.current}
          onAction={onAction}
          busy={busy}
        />
      );
    case 'otp':
      return (
        <OtpCard
          childTaskId={block.childTaskId}
          mobile={block.mobile}
          alreadySent={block.alreadySent}
          onAction={onAction}
          busy={busy}
        />
      );
    default:
      return null;
  }
}

/**
 * Eight scheme cards at once is a wall of text on a phone. The ones the
 * citizen can actually act on come first; everything else waits behind one
 * button, so the screen stays short enough to read.
 */
function SchemeResults({
  matches,
  onAction,
}: {
  matches: SchemeMatch[];
  onAction?: (action: ChatAction) => void;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const good = matches.filter((match) => match.level === 'potential_match');
  const rest = matches.filter((match) => match.level !== 'potential_match');
  const primary = good.length > 0 ? good : rest.slice(0, 1);
  const hidden = matches.filter((match) => !primary.includes(match));

  return (
    <div className="space-y-3">
      {primary.map((match) => (
        <SchemeCard key={match.schemeId} match={match} onAction={onAction} />
      ))}

      {hidden.length > 0 && !showAll ? (
        <Button variant="secondary" className="w-full" onClick={() => setShowAll(true)}>
          Show {hidden.length} more {hidden.length === 1 ? 'programme' : 'programmes'}
        </Button>
      ) : null}

      {showAll
        ? hidden.map((match) => (
            <SchemeCard key={match.schemeId} match={match} onAction={onAction} />
          ))
        : null}
    </div>
  );
}

/** A short ticked list of papers, instead of a card each. */
function DocumentTickList({
  documents,
  title,
}: {
  documents: CitizenDocument[];
  title?: string;
}) {
  if (documents.length === 0) return null;
  return (
    <Card>
      <CardBody className="space-y-2">
        {title ? (
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</h3>
        ) : null}
        <ul className="space-y-1.5">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center gap-2 text-[15px] text-ink">
              <Check className="size-4 shrink-0 text-ok" aria-hidden="true" />
              {document.name}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
