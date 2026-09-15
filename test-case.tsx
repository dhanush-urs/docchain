import React, { useState, useEffect } from 'react'

function Test() {
  const [nodes, setNodes] = React.useState<any[]>([])

  React.useEffect(function() {
    const newNodes = [1,2,3].map(function(data, index) {
      return {
        id: data,
        type: 'custom',
        position: { x: 0, y: index * 200 },
        data: data,
        draggable: false,
      }
    })

    const newEdges = newNodes.slice(0, -1).map(function(node, index) {
      return {
        id: 'edge-' + node.id + '-' + (newNodes[index + 1]?.id || ''),
        source: node.id,
        target: newNodes[index + 1]?.id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'white', strokeWidth: 1, strokeDasharray: '4,4', opacity: 0.2 },
        markerEnd: { type: 'arrowclosed', color: 'white', width: 10, height: 10 },
      }
    })

    setNodes(newNodes)
  }, [])

  return React.createElement('div', null, 'Test')
}

export default Test
