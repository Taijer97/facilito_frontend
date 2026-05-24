import fs from 'fs';

const files = [
  'src/pages/AdminDashboard.tsx',
  'src/pages/UserDashboard.tsx',
  'src/pages/ActiveRaffles.tsx',
  'src/pages/Home.tsx',
  'src/components/Layout.tsx',
  'src/pages/Results.tsx',
  'src/pages/Terms.tsx',
  'src/pages/Privacy.tsx',
  'src/pages/RaffleDetail.tsx',
  'src/components/ProfileCompletionModal.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/border-8/g, 'border-2');
    content = content.replace(/border-6/g, 'border-2');
    content = content.replace(/border-4/g, 'border-2');
    
    content = content.replace(/shadow-\[16px_16px/g, 'shadow-\[4px_4px');
    content = content.replace(/shadow-\[12px_12px/g, 'shadow-\[4px_4px');
    content = content.replace(/shadow-\[8px_8px/g, 'shadow-\[2px_2px');
    content = content.replace(/shadow-\[6px_6px/g, 'shadow-\[2px_2px');
    content = content.replace(/shadow-\[4px_4px/g, 'shadow-\[2px_2px');
    
    content = content.replace(/rounded-\[3rem\]/g, 'rounded-2xl');
    content = content.replace(/rounded-\[2rem\]/g, 'rounded-xl');
    content = content.replace(/rounded-4xl/g, 'rounded-xl');
    content = content.replace(/rounded-3xl/g, 'rounded-xl');
    
    content = content.replace(/p-12/g, 'p-6');
    content = content.replace(/p-10/g, 'p-6');
    content = content.replace(/p-8/g, 'p-4');
    content = content.replace(/py-8/g, 'py-4');
    content = content.replace(/px-8/g, 'px-4');
    content = content.replace(/p-6/g, 'p-4');
    content = content.replace(/py-6/g, 'py-3');
    content = content.replace(/px-6/g, 'px-4');
    
    content = content.replace(/mb-12/g, 'mb-6');
    content = content.replace(/mb-10/g, 'mb-5');
    content = content.replace(/mb-8/g, 'mb-4');
    
    content = content.replace(/max-w-7xl/g, 'max-w-5xl');
    content = content.replace(/max-w-5xl/g, 'max-w-4xl');
    
    content = content.replace(/text-6xl/g, 'text-4xl');
    content = content.replace(/text-5xl/g, 'text-3xl');
    content = content.replace(/text-4xl/g, 'text-2xl');
    content = content.replace(/text-3xl/g, 'text-xl');
    content = content.replace(/text-2xl/g, 'text-lg');
    
    content = content.replace(/sm:border-8/g, 'sm:border-2');
    content = content.replace(/sm:border-4/g, 'sm:border-2');
    content = content.replace(/md:border-\[6px\]/g, 'md:border-2');
    
    fs.writeFileSync(file, content, 'utf8');
  }
});
