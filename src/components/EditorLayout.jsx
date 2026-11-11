import SidebarPlaylist from './SidebarPlaylist';
import TopBar from './TopBar';
import WorkspaceArea from './WorkspaceArea';

export default function EditorLayout({ sidebarProps, topBarProps, workspaceProps, notice }) {
  return (
    <>
      <SidebarPlaylist {...sidebarProps} />
      <div className="flex min-w-0 flex-1 flex-col bg-[#202124]">
        <TopBar {...topBarProps} />
        {notice}
        <WorkspaceArea {...workspaceProps} />
      </div>
    </>
  );
}
