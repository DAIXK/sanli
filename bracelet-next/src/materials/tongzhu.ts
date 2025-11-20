const RADIAL_ROTATION = (3 * Math.PI) / 2
const NORMAL_ROTATION = Math.PI / 2

const config = {
  '1': {
    price: '-',
    name: '7*8手串',
    background: [
      { glb: '/static/models/圈圈45.gltf', name: '7*8手串', length: 14, max:29 },
    
    ],
    product: [
      {
        glb: '/static/models/磨砂珠6mm.gltf',
        name: '磨砂珠',
        weight: '1',
        width: '6mm',
        price: '980',
        type: 'gold',
        rotation: RADIAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/磨砂珠6mm.png'
      },
      
     
      
      {
        glb: '/static/models/红玛瑙.gltf',
        name: '红玛瑙',
        weight: '2',
        width: '6mm',
        price: '20',
        rotation: NORMAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/红玛瑙.png'
      },
      {
        glb: '/static/models/黑玛瑙.gltf',
        name: '黑玛瑙',
        weight: '2',
        width: '6mm',
        price: '20',
        rotation: NORMAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/黑玛瑙.png'
      },
      {
        glb: '/static/models/绿玛瑙.gltf',
        name: '绿玛瑙',
        weight: '2',
        width: '6mm',
        price: '20',
        rotation: NORMAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/绿玛瑙.png'
      },
      {
        glb: '/static/models/蓝玛瑙.gltf',
        name: '蓝玛瑙',
        weight: '2',
        width: '6mm',
        price: '20',
        rotation: NORMAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/蓝玛瑙.png'
      },
      
      {
        glb: '/static/models/白玛瑙1.gltf',
        name: '白玛瑙',
        weight: '2',
        width: '6mm',
        price: '20',
        rotation: NORMAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/白玛瑙.png'
      }
    ]
  }
}

export default config
