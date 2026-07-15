import { AgentDashboard } from '@/components/agent-dashboard';
import { OnPointFooter, OnPointHeader } from '@/components/OnPointHeader';

export default function AgentPage() {
  return (
    <>
      <OnPointHeader />
      <AgentDashboard />
      <OnPointFooter />
    </>
  );
}
