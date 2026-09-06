import bcrypt from 'bcryptjs';

/** Produces a stable product-style image URL. */
export const img = (seed, w = 720, h = 720) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

export const categories = [
  { name: 'Smartphones & Accessories', slug: 'smartphones-accessories', description: 'Latest smartphones, chargers, cases and mobile accessories', order: 1 },
  { name: 'Laptops & Computers', slug: 'laptops-computers', description: 'Laptops, desktops and computer peripherals', order: 2 },
  { name: 'Audio & Wearables', slug: 'audio-wearables', description: 'Headphones, earbuds, speakers and smart wearables', order: 3 },
  { name: 'Fashion', slug: 'fashion', description: 'Apparel for men and women from top brands', order: 4 },
  { name: 'Footwear', slug: 'footwear', description: 'Sneakers, sports shoes and casual footwear', order: 5 },
  { name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Cookware, appliances and home essentials', order: 6 },
  { name: 'Beauty & Grooming', slug: 'beauty-grooming', description: 'Skincare, haircare and personal grooming', order: 7 },
  { name: 'Sports & Fitness', slug: 'sports-fitness', description: 'Sports equipment and fitness accessories', order: 8 },
  { name: 'Books & Stationery', slug: 'books-stationery', description: 'Bestselling books and study essentials', order: 9 },
  { name: 'Toys & Gaming', slug: 'toys-gaming', description: 'Toys, games and accessories for all ages', order: 10 },
];

const P = (name, brand, category, mrp, price, stock, extra = {}) => ({
  name,
  brand,
  category,
  mrp,
  price,
  stock,
  sku: `${brand.slice(0, 3).toUpperCase()}-${name.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 18).toUpperCase()}-${mrp}`,
  images: [img(name + '-1'), img(name + '-2'), img(name + '-3')],
  thumbnail: img(name + '-1'),
  specifications: extra.specifications || [{ label: 'Brand', value: brand }],
  tags: extra.tags || [],
  featured: extra.featured || false,
  bestseller: extra.bestseller || false,
  description: [
    `${name} from ${brand} - a top-rated choice in our ${category.replace(/-/g, ' ')} collection.`,
    extra.features || `${brand} brings you reliable quality combined with a premium build, backed by warranty and responsive support.`,
  ].join(' '),
});

export const products = [
  // ---- Smartphones & Accessories ----
  P('Galaxy S24 Ultra 5G', 'Samsung', 'smartphones-accessories', 134999, 110999, 15, {
    featured: true, bestseller: true,
    features: '6.8-inch Dynamic AMOLED, 200MP camera, 5000mAh battery, 12GB RAM, AI-powered One UI 6.1.',
    specifications: [{ label: 'Display', value: '6.8" QHD+ AMOLED 120Hz' }, { label: 'Camera', value: '200MP Quad' }, { label: 'Battery', value: '5000 mAh' }],
  }),
  P('Redmi Note 13 Pro 5G', 'Xiaomi', 'smartphones-accessories', 29999, 23999, 40, {
    bestseller: true,
    features: '200MP OIS camera, 67W TurboCharge, MediaTek Dimensity 7200 Ultra, 120Hz AMOLED.',
    specifications: [{ label: 'Display', value: '6.67" AMOLED 120Hz' }, { label: 'Camera', value: '200MP OIS' }, { label: 'Battery', value: '5100 mAh' }],
  }),
  P('OnePlus 12R 5G', 'OnePlus', 'smartphones-accessories', 42999, 33999, 25, {
    featured: true,
    features: 'Snapdragon 8 Gen 2, 100W SUPERVOOC, Hasselblad camera system, 5500mAh battery.',
  }),
  P('realme GT 5 Pro', 'realme', 'smartphones-accessories', 55999, 43999, 12, {
    features: 'Snapdragon 8 Gen 3, 5400mAh, 120W SuperVOOC, 6.78-inch 144Hz LTPO display.',
  }),
  P('Moto G64 5G', 'Motorola', 'smartphones-accessories', 19999, 15499, 30, {
    features: 'Dimensity 7025, 50MP OIS camera, 6000mAh battery, near-stock Android 14.',
  }),

  // ---- Laptops & Computers ----
  P('Pavilion 15-fd0132TU', 'HP', 'laptops-computers', 68999, 58499, 18, {
    featured: true,
    features: 'Intel Core i5-1334U, 16GB DDR4, 512GB SSD, 15.6-inch FHD micro-edge display.',
  }),
  P('Inspiron 15 3530', 'Dell', 'laptops-computers', 68990, 51990, 22, {
    bestseller: true,
    features: 'Intel Core i5-1335U, 16GB RAM, 512GB SSD, 15.6" FHD, backlit keyboard.',
  }),
  P('IdeaPad Slim 5 14", AMD', 'Lenovo', 'laptops-computers', 74990, 60890, 14, {
    features: 'Ryzen 7 7735HS, 16GB RAM, 1TB SSD, 14" 2.2K IPS display.',
  }),
  P('Vivobook 15 X1504VA', 'ASUS', 'laptops-computers', 52999, 44999, 20, {
    features: 'Intel Core i5-1335U, 16GB RAM, 512GB SSD, 15.6" FHD, RGB backlit keyboard.',
  }),
  P('MacBook Air 13 M3', 'Apple', 'laptops-computers', 114900, 99990, 9, {
    featured: true, bestseller: true,
    features: 'Apple M3 chip, 8-core GPU, 8GB unified memory, 256GB SSD, 18-hour battery.',
  }),

  // ---- Audio & Wearables ----
  P('Airdopes 141 ANC Earbuds', 'boAt', 'audio-wearables', 3499, 1799, 60, {
    bestseller: true,
    features: 'ANC, 42-hour playtime, ENx tech, low latency gaming mode, IPX4 rating.',
  }),
  P('NoiseFit Halo Smart Watch', 'Noise', 'audio-wearables', 6499, 3999, 45, {
    features: '1.43" AMOLED display, Bluetooth calling, 110+ sports modes, 7-day battery.',
  }),
  P('WH-CH520 Wireless Headphones', 'Sony', 'audio-wearables', 3990, 2990, 28, {
    features: '50-hour battery, DSEE upscaling, multipoint connection, lightweight 147g design.',
  }),
  P('Flip 6 Bluetooth Speaker', 'JBL', 'audio-wearables', 10999, 7999, 16, {
    features: 'IP67 waterproof, 12-hour playtime, deep bass, JBL PartyBoost pairing.',
  }),
  P('Buds Z2 ANC Earbuds', 'OnePlus', 'audio-wearables', 4199, 2499, 35, {
    features: 'Dirac audio tuning, 38-hour battery, 33ms low latency, IP55 rating.',
  }),

  // ---- Fashion ----
  P('Men Slim Fit Causal Shirt', 'Roadster', 'fashion', 1499, 999, 50, {
    bestseller: true,
    features: '100% cotton, slim fit, wrinkle-resistant finish, ideal for office and casual wear.',
    specifications: [{ label: 'Fit', value: 'Slim' }, { label: 'Fabric', value: '100% Cotton' }, { label: 'Sleeve', value: 'Full Sleeve' }],
  }),
  P('Women A-Line Midi Dress', 'H&M', 'fashion', 2499, 1599, 32, {
    features: 'A-line silhouette, breathable viscose blend, perfect for parties and summers.',
  }),
  P('Levi\'s 512 Slim Taper Jean', 'Levi\'s', 'fashion', 3495, 2499, 26, {
    featured: true,
    features: 'Slim tapered fit, stretch denim, classic 5-pocket styling, durable stitching.',
  }),
  P('Men Regular Fit Chino', 'WROGN', 'fashion', 1999, 1299, 40, {
    features: 'Regular fit chinos, cotton-lycra blend, versatile for casual and smart looks.',
  }),
  P('Women Cotton Anarkali Kurta', 'Biba', 'fashion', 1799, 1199, 20, {
    features: 'Pure cotton anarkali, block printed, festive and everyday elegance.',
  }),

  // ---- Footwear ----
  P('Air Max Motion 2 Sneakers', 'Nike', 'footwear', 7495, 5495, 18, {
    featured: true, bestseller: true,
    features: 'Breathable mesh upper, Air-Sole cushioning, rubber outsole for everyday comfort.',
  }),
  P('Ultraboost 5.0 Running Shoes', 'Adidas', 'footwear', 15999, 10999, 12, {
    features: 'BOOST midsole, Primeknit upper, Continental rubber outsole for wet traction.',
  }),
  P('RS-X Reinvention Sneakers', 'Puma', 'footwear', 9999, 5999, 21, {
    features: 'Chunky retro silhouette, softFoam+ sockliner, leather-mesh mix upper.',
  }),
  P('Campus Royce Running Shoes', 'Campus', 'footwear', 1299, 799, 55, {
    bestseller: true,
    features: 'Anti-skid grip rubber sole, breathable mesh, cushioned insole - value running shoe.',
  }),
  P('Sparx Men Sports Shoes', 'Sparx', 'footwear', 1499, 949, 44, {
    features: 'Lightweight EVA sole, cushioned collar, durable for daily walking and gym.',
  }),

  // ---- Home & Kitchen ----
  P('Picasso Stainless Steel Pressure Cooker 5L', 'Pigeon', 'home-kitchen', 2099, 1399, 35, {
    bestseller: true,
    features: '5L SS pressure cooker, 2-year warranty, FVM system for quick cooking.',
  }),
  P('Hard Anodized Kadai 3L', 'Prestige', 'home-kitchen', 3395, 2399, 24, {
    features: 'Hard anodized non-stick kadai, induction compatible, heat-resistant handles.',
  }),
  P('Morgen Classic Bottle 1.9L', 'Milton', 'home-kitchen', 545, 399, 70, {
    features: 'Stainless steel water bottle, leak-proof, suitable for hot and cold liquids.',
  }),
  P('HL1633/20 Electric Kettle 1.5L', 'Philips', 'home-kitchen', 2195, 1599, 28, {
    featured: true,
    features: '1500W fast boiling, auto shut-off, stainless steel interior, concealed coil.',
  }),
  P('Almond & Copper Induction Glass Teapot 950ml', 'Borosil', 'home-kitchen', 1495, 999, 18, {
    features: 'Borosilicate glass infuser, durable and elegant for the perfect brew.',
  }),

  // ---- Beauty & Grooming ----
  P('Kiehl\'s Midnight Recovery Face Serum 30ml', 'L\'Oréal', 'beauty-grooming', 2499, 1899, 16, {
    features: 'Face serum with evening primrose oil, overnight renewal and radiance booster.',
  }),
  P('Vitamin C Face Wash 100ml', 'Mamaearth', 'beauty-grooming', 399, 299, 80, {
    bestseller: true,
    features: 'Enriched with Vitamin C, reduces dullness, gives instant glow - safe for all skin types.',
  }),
  P('Glow Serum 30ml', 'MINIMALIST', 'beauty-grooming', 599, 449, 50, {
    features: '10% Vitamin C face serum for beginners, lightweight, non-comedogenic.',
  }),
  P('Skin Defence SPF50+ Sunscreen 50ml', 'Neutrogena', 'beauty-grooming', 549, 389, 30, {
    features: 'Broad-spectrum SPF 50, non-greasy, water-resistant daily sunscreen.',
  }),
  P('Men Classic Beard Grooming Kit', 'Bombay Shaving Company', 'beauty-grooming', 999, 649, 25, {
    featured: true,
    features: '30-pc grooming kit with beard oil, balm, comb and scissors in a travel pouch.',
  }),

  // ---- Sports & Fitness ----
  P('Composite Badminton Racquet', 'YONEX', 'sports-fitness', 2999, 1999, 22, {
    features: 'Composite graphite frame, isometric head, suitable for club level players.',
  }),
  P('Nivia Astro Basketball - Size 7', 'Nivia', 'sports-fitness', 799, 549, 30, {
    features: 'Rubber molded basketball, official size 7, excellent grip for outdoor play.',
  }),
  P('Storm Cricket Bat - English Willow', 'Kookaburra', 'sports-fitness', 5499, 3799, 10, {
    features: 'Grade English willow, pre-knocked, lightweight pickup for match play.',
  }),
  P('10kg PVC Dumbbell Pair', 'KORE', 'sports-fitness', 1599, 999, 15, {
    features: '10kg x 2 PVC coated dumbbells, anti-slip grip, perfect for home workouts.',
  }),
  P('Gym Yoga Mat - 6mm', 'Decathlon', 'sports-fitness', 999, 599, 42, {
    features: '6mm anti-skid yoga mat, easy to clean, carry strap included.',
  }),

  // ---- Books & Stationery ----
  P('The Psychology of Money', 'Jaico Publishers', 'books-stationery', 299, 199, 48, {
    bestseller: true,
    features: 'Morgan Housel\'s bestselling guide on the psychology behind smart money decisions.',
  }),
  P('Atomic Habits', 'Random House', 'books-stationery', 699, 381, 40, {
    features: 'James Clear\'s blueprint for building good habits and breaking bad ones.',
  }),
  P('IKIGAI - The Japanese Secret to a Long and Happy Life', 'Penguin', 'books-stationery', 399, 240, 36, {
    features: 'Discover the Japanese philosophy that helps people live longer and happier.',
  }),
  P('Rich Dad Poor Dad', 'Plata Publishing', 'books-stationery', 350, 239, 52, {
    features: 'Robert Kiyosaki\'s classic on financial education and building wealth.',
  }),
  P('A Court of Thorns and Roses', 'Bloomsbury', 'books-stationery', 399, 279, 26, {
    features: 'Sarah J. Maas\'s spellbinding fantasy romance - the book that started it all.',
  }),

  // ---- Toys & Gaming ----
  P('LEGO City Police Station', 'LEGO', 'toys-gaming', 4499, 3299, 14, {
    featured: true,
    features: '650-piece police station building set with minifigures and patrol vehicle.',
  }),
  P('Hot Wheels 20 Car Gift Pack', 'Hot Wheels', 'toys-gaming', 2499, 1799, 33, {
    bestseller: true,
    features: '20 assorted 1:64 scale die-cast cars, detailed bodies, collector-friendly.',
  }),
  P('Funskool Hey Clay Zoo Animals', 'Funskool', 'toys-gaming', 699, 459, 25, {
    features: 'Air-dry modelling clay kit, safe & non-toxic, hours of creative play.',
  }),
  P('Monopoly India Edition', 'Hasbro', 'toys-gaming', 1499, 999, 20, {
    features: 'The classic board game with an Indian twist - property trading fun for the family.',
  }),
  P('Playstation 5 DualSense Controller', 'Sony', 'toys-gaming', 5999, 4999, 12, {
    features: 'Adaptive triggers, haptic feedback, built-in mic - official PS5 controller.',
  }),
];

export const users = [
  { fullname: 'Admin User', email: 'admin@shopsphere.com', role: 'admin' },
  { fullname: 'Arjun Mehta', email: 'arjun.mehta@example.com', role: 'customer' },
  { fullname: 'Priya Sharma', email: 'priya.sharma@example.com', role: 'customer' },
  { fullname: 'Rahul Verma', email: 'rahul.verma@example.com', role: 'customer' },
  { fullname: 'Sneha Iyer', email: 'sneha.iyer@example.com', role: 'customer' },
  { fullname: 'Vikram Singh', email: 'vikram.singh@example.com', role: 'customer' },
  { fullname: 'Ananya Reddy', email: 'ananya.reddy@example.com', role: 'customer' },
  { fullname: 'Karan Patel', email: 'karan.patel@example.com', role: 'customer' },
  { fullname: 'Meera Nair', email: 'meera.nair@example.com', role: 'customer' },
  { fullname: 'Rohan Gupta', email: 'rohan.gupta@example.com', role: 'customer' },
];

export const DEFAULT_PASSWORD = 'Password@123';

export const addressSeeds = [
  { fullname: 'Arjun Mehta', phone: '9812345670', address: '42, MG Road, Indiranagar', apartment: 'A-101, Skyline Apartments', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'India' },
  { fullname: 'Priya Sharma', phone: '9822334455', address: '15, Linking Road, Bandra West', apartment: '', city: 'Mumbai', state: 'Maharashtra', postalCode: '400050', country: 'India' },
  { fullname: 'Rahul Verma', phone: '9833445566', address: '78, Connaught Place', apartment: 'Flat 3B', city: 'New Delhi', state: 'Delhi', postalCode: '110001', country: 'India' },
  { fullname: 'Sneha Iyer', phone: '9844556677', address: '210, Anna Salai', apartment: '', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600002', country: 'India' },
  { fullname: 'Vikram Singh', phone: '9855667788', address: '5, Park Street', apartment: 'Tower B, Unit 704', city: 'Kolkata', state: 'West Bengal', postalCode: '700016', country: 'India' },
  { fullname: 'Karan Patel', phone: '9811882211', address: '301, CG Road', apartment: '12 Sky Condos', city: 'Ahmedabad', state: 'Gujarat', postalCode: '380009', country: 'India' },
];

export const hashPassword = (pwd) => bcrypt.hashSync(pwd, 10);