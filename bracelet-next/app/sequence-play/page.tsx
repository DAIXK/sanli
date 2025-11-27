import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sequence Play | 手串动画'
};

import SequencePlayPage from '../admin/sequence-play/page';

export default function Page() {
  return <SequencePlayPage />;
}
