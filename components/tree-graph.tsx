"use client";

import { useEffect, useRef } from "react";
import { Tree, TreeNode } from "react-d3-tree";
import { useTheme } from "next-themes";

interface ProcessedDependency {
  name: string;
  version: string;
  type: "dependency" | "devDependency";
  children?: ProcessedDependency[];
}

interface TreeGraphProps {
  data: ProcessedDependency[];
}

const convertToTreeData = (deps: ProcessedDependency[]) => {
  if (deps.length === 0) return [];
  
  // If there are multiple root nodes, create a virtual root
  if (deps.length > 1) {
    return [{
      name: "Dependencies",
      attributes: {
        type: "root"
      },
      children: deps.map(dep => ({
        name: `${dep.name}@${dep.version}`,
        attributes: {
          type: dep.type,
        },
        children: dep.children?.map(child => convertNode(child)) || [],
      }))
    }];
  }

  // Single root node
  return deps.map(convertNode);
};

const convertNode = (dep: ProcessedDependency) => {
  return {
    name: `${dep.name}@${dep.version}`,
    attributes: {
      type: dep.type,
    },
    children: dep.children?.map(child => convertNode(child)) || [],
  };
};

export function TreeGraph({ data }: TreeGraphProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const nodeSize = { x: 200, y: 100 };
  const foreignObjectProps = {
    width: nodeSize.x,
    height: nodeSize.y,
    x: -100,
    y: -50,
  };

  const treeData = convertToTreeData(data);

  if (treeData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No dependency data available
      </div>
    );
  }

  const renderForeignObjectNode = ({
    nodeDatum,
    toggleNode,
  }: {
    nodeDatum: any;
    toggleNode: () => void;
  }) => (
    <g>
      <foreignObject {...foreignObjectProps}>
        <div
          className="w-full h-full flex flex-col items-center justify-center p-2 rounded-lg border"
          style={{
            backgroundColor: theme === "dark" ? "hsl(var(--card))" : "white",
          }}
        >
          <div className="text-sm font-medium truncate w-full text-center">
            {nodeDatum.name}
          </div>
          {nodeDatum.attributes.type !== "root" && (
            <div
              className={`text-xs px-2 py-1 rounded-full mt-1 ${
                nodeDatum.attributes.type === "dependency"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {nodeDatum.attributes.type}
            </div>
          )}
        </div>
      </foreignObject>
    </g>
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <Tree
        data={treeData[0]}
        renderCustomNodeElement={renderForeignObjectNode}
        orientation="vertical"
        nodeSize={nodeSize}
        pathClassFunc={() => "stroke-primary"}
        zoom={0.7}
        enableLegacyTransitions
        separation={{ siblings: 1, nonSiblings: 2 }}
        translate={{ x: 400, y: 50 }}
      />
    </div>
  );
}