import React, { useState } from 'react';
import { ProjectFile } from '../../types/gitvox';

export interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
  file?: ProjectFile;
}

export function buildFileTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      let node = currentLevel.find((n) => n.name === part);
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          isFolder: !isFile,
          children: [],
          file: isFile ? file : undefined,
        };
        currentLevel.push(node);
      }
      currentLevel = node.children;
    }
  }

  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isFolder === b.isFolder) {
        return a.name.localeCompare(b.name);
      }
      return a.isFolder ? -1 : 1;
    });
    for (const node of nodes) {
      if (node.isFolder) {
        sortNodes(node.children);
      }
    }
  }

  sortNodes(root);
  return root;
}

interface FileTreeProps {
  files: ProjectFile[];
  selectedFilePath: string;
  onSelectFile: (filePath: string) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  selectedFilePath,
  onSelectFile,
}) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const tree = React.useMemo(() => buildFileTree(files), [files]);

  const renderIcon = (name: string) => {
    if (name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.mjs')) {
      return (
        <span className="font-mono text-[10px] font-bold text-primary px-1 py-0.2 rounded bg-primary/10 border border-primary/20 shrink-0">
          JS
        </span>
      );
    }
    if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      return (
        <span className="font-mono text-[10px] font-bold text-secondary px-1 py-0.2 rounded bg-secondary/10 border border-secondary/20 shrink-0">
          TS
        </span>
      );
    }
    if (name.endsWith('.json')) {
      return (
        <span className="font-mono text-[12px] font-bold text-secondary shrink-0 tracking-tighter">
          &#123; &#125;
        </span>
      );
    }
    if (name.endsWith('.md')) {
      return (
        <span className="material-symbols-outlined text-[16px] text-outline shrink-0">
          description
        </span>
      );
    }
    return (
      <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">
        code
      </span>
    );
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const isFolder = node.isFolder;
    const isCollapsed = Boolean(collapsedFolders[node.path]);
    const isSelected = !isFolder && node.path === selectedFilePath;

    if (isFolder) {
      return (
        <div key={node.path} className="flex flex-col">
          <div
            onClick={(e) => toggleFolder(node.path, e)}
            className="flex items-center gap-1.5 py-1 px-1 text-on-surface-variant hover:text-on-surface cursor-pointer select-none rounded hover:bg-surface-container/50 transition-colors group"
            style={{ paddingLeft: `${depth * 14 + 4}px` }}
          >
            <span className="material-symbols-outlined text-[16px] text-outline group-hover:text-on-surface transition-transform">
              {isCollapsed ? 'arrow_right' : 'arrow_drop_down'}
            </span>
            <span className="material-symbols-outlined text-[16px] text-secondary">
              folder
            </span>
            <span className="font-telemetry-tag text-[12px] tracking-tight text-on-surface font-medium truncate">
              {node.name}
            </span>
          </div>

          {!isCollapsed && node.children.length > 0 && (
            <div className="flex flex-col">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // File Node
    return (
      <div
        key={node.path}
        onClick={() => onSelectFile(node.path)}
        className={`flex items-center justify-between py-1 px-2 my-0.5 rounded cursor-pointer select-none transition-all ${
          isSelected
            ? 'bg-surface-container-highest text-primary border border-primary/30 shadow-[0_0_12px_rgba(245,158,11,0.15)] font-semibold'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
        }`}
        style={{ paddingLeft: `${depth * 14 + 18}px` }}
      >
        <div className="flex items-center gap-2 truncate">
          {renderIcon(node.name)}
          <span
            className={`font-telemetry-tag text-[12px] truncate ${
              isSelected ? 'text-primary font-bold' : 'text-on-surface'
            }`}
          >
            {node.name}
          </span>
        </div>
        {isSelected && (
          <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#f59e0b] shrink-0 ml-2"></span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full py-1">
      {tree.map((node) => renderNode(node, 0))}
    </div>
  );
};

