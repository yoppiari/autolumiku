#!/bin/bash

echo "================================================================================"
echo "📦 Installing Epic 2 Dependencies"
echo "================================================================================"
echo ""

echo "Installing core dependencies..."
echo "--------------------------------------------------------------------------------"

# Core dependencies for Epic 2
npm install \
  openai \
  @aws-sdk/client-s3 \
  @aws-sdk/s3-request-presigner \
  sharp \
  @prisma/client \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-label \
  @radix-ui/react-select \
  @radix-ui/react-separator \
  @radix-ui/react-slot \
  @radix-ui/react-tabs \
  @dnd-kit/core \
  @dnd-kit/sortable \
  @dnd-kit/utilities \
  react-dropzone \
  lucide-react \
  class-variance-authority \
  clsx \
  tailwind-merge

echo ""
echo "Installing dev dependencies..."
echo "--------------------------------------------------------------------------------"

npm install -D prisma

echo ""
echo "================================================================================"
echo "✅ Epic 2 Dependencies Installation Complete!"
echo "================================================================================"
echo ""
echo "Installed packages:"
echo "  - openai (z.ai GLM compatibility)"
echo "  - @aws-sdk/* (Cloudflare R2 storage)"
echo "  - sharp (image processing)"
echo "  - @prisma/client (database ORM)"
echo "  - @radix-ui/* (UI components)"
echo "  - @dnd-kit/* (drag-drop functionality)"
echo "  - react-dropzone (file upload)"
echo "  - lucide-react (icons)"
echo ""
echo "Next steps:"
echo "  1. Setup Prisma: npx prisma generate"
echo "  2. Run migrations: npx prisma migrate dev"
echo "  3. Start dev server: npm run dev"
echo ""
echo "================================================================================"
