"use client";

import { useState, useEffect } from "react";
import { Bot, ShoppingBag, ExternalLink } from "lucide-react";

interface AgentActivity {
  id: string;
  action: "purchase" | "try_on";
  curator: string;
  item: string;
  amount: string;
  timestamp: string;
  agentId: string;
}

// Mock data - replace with real API endpoint later
const MOCK_ACTIVITIES: AgentActivity[] = [
  {
    id: "1",
    action: "purchase",
    curator: "Wanja",
    item: "Arsenal 24/25 Home Kit (M)",
    amount: "$19.23",
    timestamp: "2 min ago",
    agentId: "agent_0x7a3b...",
  },
  {
    id: "2",
    action: "try_on",
    curator: "Nia Digital",
    item: "Jersey Dress",
    amount: "$0.03",
    timestamp: "5 min ago",
    agentId: "agent_0x9c2f...",
  },
  {
    id: "3",
    action: "purchase",
    curator: "Grace",
    item: "Manchester United Away Kit (L)",
    amount: "$22.50",
    timestamp: "12 min ago",
    agentId: "agent_0x4e1d...",
  },
  {
    id: "4",
    action: "try_on",
    curator: "Faith",
    item: "Chelsea Home Kit (S)",
    amount: "$0.05",
    timestamp: "18 min ago",
    agentId: "agent_0x8b5a...",
  },
  {
    id: "5",
    action: "purchase",
    curator: "Nia Digital",
    item: "Kit Remix Design",
    amount: "$0.10",
    timestamp: "25 min ago",
    agentId: "agent_0x2f9c...",
  },
];

export function AgentActivityFeed() {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Simulate loading activities
    setActivities(MOCK_ACTIVITIES);
    
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (activities.length === 0) return null;

  return (
    <div
      className={`max-w-4xl mx-auto transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Live Agent Activity
              </h3>
              <p className="text-xs text-muted-foreground">
                AI agents are buying real fashion right now
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-600 font-medium">Live</span>
          </div>
        </div>

        <div className="space-y-2">
          {activities.slice(0, 5).map((activity, index) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 p-3 bg-background/50 hover:bg-background/70 rounded-lg transition-colors"
              style={{
                animation: `fadeInUp 0.4s ease-out ${index * 0.1}s both`,
              }}
            >
              <div className="flex-shrink-0">
                {activity.action === "purchase" ? (
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-green-400" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-blue-400" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    {activity.agentId}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {activity.action === "purchase" ? "bought" : "tried on"}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground truncate">
                  {activity.item}
                </p>
                <p className="text-xs text-muted-foreground">
                  from {activity.curator} · {activity.amount}
                </p>
              </div>

              <div className="flex-shrink-0 text-right">
                <p className="text-xs text-muted-foreground">
                  {activity.timestamp}
                </p>
                {activity.action === "purchase" && (
                  <a
                    href="https://celoscan.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-1"
                  >
                    View TX
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-indigo-500/20">
          <p className="text-xs text-center text-muted-foreground">
            All transactions settled on Celo blockchain · Gas fees paid by platform
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
