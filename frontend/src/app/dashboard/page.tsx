"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PipelineStats } from "@/components/pipeline-stats";
import { IncidentMap } from "@/components/incident-map";
import { IncidentTable } from "@/components/incident-table";
import { IncidentDetailPanel } from "@/components/incident-detail-panel";
import type { Incident } from "@/types/incident";

export default function DashboardPage() {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    null
  );
  const [panelOpen, setPanelOpen] = useState(false);

  function handleSelectIncident(incident: Incident) {
    setSelectedIncident(incident);
    setPanelOpen(true);
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "220px",
          "--header-height": "48px",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-5 md:p-5">
          {/* Row 1 — live pipeline stats (4 cards) */}
          <PipelineStats />

          {/* Row 2 — map + incident table */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-5">
            {/* Map takes 3/5 width — fixed height on mobile, fills on desktop */}
            <div className="h-[440px] lg:col-span-3 lg:h-full lg:min-h-[440px]">
              <IncidentMap onSelectIncident={handleSelectIncident} />
            </div>

            {/* Incident table takes 2/5 width */}
            <div className="flex min-h-[300px] flex-col lg:col-span-2">
              <IncidentTable
                onSelectIncident={handleSelectIncident}
                selectedId={selectedIncident?.id ?? null}
              />
            </div>
          </div>
        </div>

        {/* Slide-in detail panel */}
        <IncidentDetailPanel
          incidentId={selectedIncident?.id ?? null}
          open={panelOpen}
          onOpenChange={setPanelOpen}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
