import { ChatWorkspaceHome } from '../adaptive/ChatWorkspaceHome';
import React from 'react';
import type { RingRecording } from '../ring/types';

export type AgentEntry = {
  id: string;
  title: string;
  text: string;
  time: number;
  uri?: string;
  file?: RingRecording;
};
type Props = {
  entries: AgentEntry[];
  onOpen: (entry: AgentEntry) => void;
  onDelete: (entry: AgentEntry) => void;
  onRecord: () => void;
  onDevice: () => void;
  onSettings: () => void;
  onOpenMailbox?: (messageId?: string) => void;
  onUseFramework?: (text: string) => void;
};
export function AgentDashboard(props: Props) {
  return (
    <ChatWorkspaceHome
      entries={props.entries}
      onOpenEntry={props.onOpen}
      onSettings={props.onSettings}
      onOpenMailbox={props.onOpenMailbox}
      onTalk={props.onUseFramework}
    />
  );
}
