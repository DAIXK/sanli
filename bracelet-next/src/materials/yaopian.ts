const RADIAL_ROTATION = (3 * Math.PI) / 2

const config = {
  '2': {
    price: '22',
    name: '4*6手串',
    background: [
      { glb: '/static/models/圈圈45.gltf', name: '4*6手串', length: 14,max:45},
    
    ],
    product: [
      {
        glb: '/static/models/白药片.gltf',
        name: '药片白玛瑙',
        weight: '1',
        width: '4mm',
        price: '20',
        rotation: RADIAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/药片白玛瑙.png'
      },
      {
        glb: '/static/models/黑药片.gltf',
        name: '药片黑玛瑙',
        weight: '1',
        width: '4mm',
        price: '20',
        rotation: RADIAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/药片黑玛瑙.png'
      },
     
      {
        glb: '/static/models/红药片.gltf',
        name: '药片红玛瑙',
        weight: '1',
        width: '4mm',
        price: '20',
        rotation: RADIAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/药片红玛瑙.png'
      },
      
      {
        glb: '/static/models/蓝药片.gltf',
        name: '药片蓝玛瑙',
        weight: '1',
        width: '4mm',
        price: '20',
        rotation: RADIAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/药片蓝玛瑙.png'
      },
      {
        glb: '/static/models/绿药片.gltf',
        name: '药片绿玛瑙',
        weight: '1',
        width: '4mm',
        price: '20',
        rotation: RADIAL_ROTATION,
        rotationAxis: 'radial',
        png: '/static/models/药片绿玛瑙.png'
      }
    ]
  }
}

export default config
