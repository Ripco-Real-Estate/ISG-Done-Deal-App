// App shell: persistent Sidebar + Topbar + global Agent panel slot.
// TODO (M1): implement components/chrome/{Sidebar,Topbar,AgentPanel}.
// Sidebar groups mirror Lev: Deals (Pipeline, All listings, Pitches),
// Network (Companies, People/Contacts), Properties, Canvassing, Agreements, Reports.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* <Sidebar /> */}
      <div className="flex-1 flex flex-col">
        {/* <Topbar /> */}
        <main className="flex-1">{children}</main>
      </div>
      {/* <AgentPanel /> */}
    </div>
  );
}
