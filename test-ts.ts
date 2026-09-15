import * as React from 'react'

interface TimelineNodeData {
  block: {
    id: string
    block_index: number
  }
}

export function TimelineVisualization({ nodes: timelineData }: { nodes: any[] }) {
  const [nodes, setNodes] = React.useState<any[]>([])
  
  React.useEffect(() => {
    const newNodes = timelineData.map((data, index) => ({
      id: data.block.id,
      type: 'custom',
      position: { x: 0, y: index * 200 },
      data,
      draggable: false,
    }))

    const newEdges = newNodes.slice(0, -1).map((node, index) => ({
      id: 'edge-' + node.id + '-' + (newNodes[index + 1]?.id || ''),
      source: node.id,
      target: newNodes[index + 1]?.id,
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'white', strokeWidth: 1, strokeDasharray: '4,4', opacity: 0.2 },
      markerEnd: { type: 'arrowclosed', color: 'white', width: 10, height: 10 },
    }))

    setNodes(newNodes)
  }, [timelineData])

  return React.createElement('div', null, 'Test')
}
