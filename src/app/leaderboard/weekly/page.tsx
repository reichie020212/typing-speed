import { LeaderboardPage } from '@/components/leaderboard/LeaderboardPage';

interface Props {
  searchParams: Promise<{ mode?: string; offset?: string }>;
}

export default function Page(props: Props) {
  return <LeaderboardPage window="weekly" searchParams={props.searchParams} />;
}
