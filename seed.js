const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'database.json');

// Build new database
const catCampaign = uuidv4();
const catUiUx = uuidv4();

const projMeraas = uuidv4();
const projMattel = uuidv4();
const projGreenPlanet = uuidv4();
const projLaguna = uuidv4();

const db = {
  users: [{ id: '1', username: 'admin', password: bcrypt.hashSync('admin123', 10) }],
  categories: [
    { id: catCampaign, name: 'Campaign Design', slug: 'campaign-design' },
    { id: catUiUx, name: 'Creative Direction', slug: 'creative-direction' }
  ],
  projects: [
    {
      id: projMeraas,
      title: 'MERAAS',
      description: 'Creative campaign design and visual execution for MERAAS — one of Dubai\'s leading developers, encompassing social media creatives, promotional banners, and large-scale campaign materials.',
      categoryId: catCampaign,
      coverImage: '/uploads/meraas_2.jpg',
      blocks: [
        { id: uuidv4(), type: 'image', content: '/uploads/meraas_2.jpg', order: 0 },
        { id: uuidv4(), type: 'image', content: '/uploads/meraas_3.jpg', order: 1 },
        { id: uuidv4(), type: 'image', content: '/uploads/meraas_4.jpg', order: 2 },
        { id: uuidv4(), type: 'image', content: '/uploads/meraas_5.jpg', order: 3 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: projMattel,
      title: 'MATTEL PLAY TOWN',
      description: 'Mattel Play! Town is an indoor educational play area located in City Walk, Dubai. Five themed zones focus on different social skills and educational elements through imaginative play, featuring popular characters and immersive brand environments.',
      categoryId: catCampaign,
      coverImage: '/uploads/mattel_1.jpg',
      blocks: [
        { id: uuidv4(), type: 'text', content: 'Mattel Play! Town is an indoor educational play area located in City Walk. Five themed zones focus on different social skills and educational elements through imaginative play. It includes zones based on popular characters and educational themes, creating an immersive brand experience for families.', order: 0 },
        { id: uuidv4(), type: 'image', content: '/uploads/mattel_1.jpg', order: 1 },
        { id: uuidv4(), type: 'image', content: '/uploads/mattel_2.jpg', order: 2 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: projGreenPlanet,
      title: 'THE GREEN PLANET',
      description: 'Gift card campaign creative concept and execution for The Green Planet, Dubai. The project features design work for promotional gift cards and digital website banners, combining nature-inspired aesthetics with bold campaign messaging.',
      categoryId: catCampaign,
      coverImage: '/uploads/greenplanet_1.jpg',
      blocks: [
        { id: uuidv4(), type: 'text', content: 'Gift card campaign creative concept and execution. The project features design work for promotional gift cards and digital website banners for The Green Planet — a tropical rainforest in the heart of Dubai.', order: 0 },
        { id: uuidv4(), type: 'image', content: '/uploads/greenplanet_1.jpg', order: 1 },
        { id: uuidv4(), type: 'image', content: '/uploads/greenplanet_2.jpg', order: 2 },
        { id: uuidv4(), type: 'image', content: '/uploads/greenplanet_3.jpg', order: 3 },
        { id: uuidv4(), type: 'image', content: '/uploads/greenplanet_4.jpg', order: 4 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: projLaguna,
      title: 'LAGUNA WATERPARK',
      description: 'Creative concept and execution for social media advertisements and large-scale outdoor banners for Laguna Waterpark, focusing on special offers and seasonal campaigns that drive footfall and engagement.',
      categoryId: catCampaign,
      coverImage: '/uploads/laguna_1.jpg',
      blocks: [
        { id: uuidv4(), type: 'text', content: 'Creative concept and execution for social media advertisements and large-scale outdoor banners for Laguna Waterpark, focusing on special offers and seasonal campaigns.', order: 0 },
        { id: uuidv4(), type: 'image', content: '/uploads/laguna_1.jpg', order: 1 },
        { id: uuidv4(), type: 'image', content: '/uploads/laguna_2.jpg', order: 2 },
        { id: uuidv4(), type: 'image', content: '/uploads/laguna_3.jpg', order: 3 },
        { id: uuidv4(), type: 'image', content: '/uploads/laguna_4.jpg', order: 4 },
        { id: uuidv4(), type: 'image', content: '/uploads/laguna_5.jpg', order: 5 },
        { id: uuidv4(), type: 'image', content: '/uploads/laguna_6.jpg', order: 6 }
      ],
      createdAt: new Date().toISOString()
    }
  ]
};

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log('✅ Database seeded with 4 Behance projects and 17 images!');
