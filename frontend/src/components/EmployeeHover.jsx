import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Slack } from "lucide-react";

export function slackDeepLink(emp, teamId) {
  if (!emp?.slack_id) return null;
  return teamId
    ? `https://slack.com/app_redirect?channel=${emp.slack_id}&team=${teamId}`
    : `https://slack.com/app_redirect?channel=${emp.slack_id}`;
}

export default function EmployeeHover({ employee, people = [], teamId = "", children }) {
  if (!employee) return children;
  const mgr = people.find((p) => p.id === employee.reports_to);
  const reportees = people.filter((p) => p.reports_to === employee.id);
  const link = slackDeepLink(employee, teamId);

  return (
    <HoverCard openDelay={150} closeDelay={150}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80 p-0 overflow-hidden" data-testid={`employee-hover-${employee.id}`}>
        <div className="bg-slate-900 px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center text-xs font-bold font-display shrink-0">
            {employee.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-display font-semibold text-white text-sm truncate">{employee.name}</div>
            <div className="text-[11px] text-slate-400 truncate">{employee.title}{employee.department ? ` · ${employee.department}` : ""}</div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-col items-center text-center" data-testid={`employee-hover-chart-${employee.id}`}>
            {mgr ? (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Reports to</div>
                <div className="mt-1 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-800">{mgr.name} <span className="font-normal text-slate-500">· {mgr.title}</span></div>
                <div className="w-px h-3 bg-slate-300" />
              </>
            ) : (
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Top of hierarchy</div>
            )}
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 text-xs font-semibold text-cyan-400">{employee.name}</div>
            {reportees.length > 0 && (
              <>
                <div className="w-px h-3 bg-slate-300" />
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Direct reportees</div>
                <div className="flex flex-wrap gap-1 justify-center mt-1">
                  {reportees.map((r) => (
                    <span key={r.id} className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] text-slate-700 border border-slate-200">{r.name}</span>
                  ))}
                </div>
              </>
            )}
          </div>
          {link ? (
            <a href={link} data-testid={`employee-slack-button-${employee.id}`}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-[#4A154B] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
              <Slack className="h-4 w-4" /> Message on Slack
            </a>
          ) : (
            <div className="text-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg py-2" data-testid={`employee-slack-missing-${employee.id}`}>
              Slack ID not set — ask admin to add it
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
