import SidebarPlaylist from './SidebarPlaylist';
import TopBar from './TopBar';
import WorkspaceArea from './WorkspaceArea';

export default function EditorLayout({ isDark, sidebarProps, topBarProps, workspaceProps }) {
  return (
    <>
      <SidebarPlaylist {...sidebarProps} />
      <div className={`flex-1 flex flex-col min-w-0 ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
        <TopBar {...topBarProps} />
        <WorkspaceArea {...workspaceProps} />
      </div>
    </>
  );
}
