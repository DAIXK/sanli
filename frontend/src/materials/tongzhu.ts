const RADIAL_ROTATION = (3 * Math.PI) / 2
const NORMAL_ROTATION = Math.PI / 2

export default {
  '1': {
    price: '2288',
    name: '7*8手串',
    background: [
      { glb: '/static/models/圈圈45.gltf', name: '7*8手串', length: 14 },
      { glb: '/static/models/圈圈47.gltf', name: '7*8手串', length: 15 },
      { glb: '/static/models/圈圈51.gltf', name: '7*8手串', length: 16 },
      { glb: '/static/models/圈圈54.gltf', name: '7*8手串', length: 17 },
      { glb: '/static/models/圈圈57.gltf', name: '7*8手串', length: 18 },
      { glb: '/static/models/圈圈60.gltf', name: '7*8手串', length: 19 }
    ],
    product: [
      {
        glb: '/static/models/磨砂珠6mm.gltf',
        name: '磨砂珠',
        weight: '1',
        width: '6mm',
        rotation: RADIAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/磨砂珠6mm.png'
      },
      
     
      
      {
        glb: '/static/models/红玛瑙.gltf',
        name: '红玛瑙',
        weight: '2',
        width: '6mm',
        rotation: NORMAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/红玛瑙.png'
      },
      {
        glb: '/static/models/黑玛瑙.gltf',
        name: '黑玛瑙',
        weight: '2',
        width: '6mm',
        rotation: NORMAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/黑玛瑙.png'
      },
      {
        glb: '/static/models/绿玛瑙.gltf',
        name: '绿玛瑙',
        weight: '2',
        width: '6mm',
        rotation: NORMAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/绿玛瑙.png'
      },
      {
        glb: '/static/models/蓝玛瑙.gltf',
        name: '蓝玛瑙',
        weight: '2',
        width: '6mm',
        rotation: NORMAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/蓝玛瑙.png'
      },
      
      {
        glb: '/static/models/白玛瑙1.gltf',
        name: '白玛瑙',
        weight: '2',
        width: '6mm',
        rotation: NORMAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/白玛瑙.png'
      }
    ]
  }
}
