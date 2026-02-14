import { useState, useMemo, lazy, Suspense, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Search, Book, Video, Zap, CreditCard, Shield, MessageCircle,
  ChevronRight, ChevronDown, ArrowLeft, ExternalLink, 
  Play, FileText, HelpCircle, Lightbulb, Sparkles,
  Settings, Users, Upload, Download, Palette, Clock,
  CheckCircle, AlertCircle, Star, ArrowUpRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SafeMarkdownRenderer } from '@/components/content/SafeMarkdownRenderer';

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

// Help categories with articles
const HELP_CATEGORIES = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics and create your first video',
    icon: Zap,
    color: 'from-emerald-500 to-teal-500',
    articles: [
      {
        id: 'create-first-video',
        title: 'Create Your First AI Video',
        description: 'Step-by-step guide to generating your first professional video',
        readTime: '5 min',
        popular: true,
        content: `
## Create Your First AI Video

Welcome to Apex Studio! This guide walks you through creating your first AI-generated video in minutes.

### Step 1: Choose Your Creation Mode

From the **Create** page, select your video generation mode:
- **Text-to-Video**: Describe your vision and AI generates it
- **Image-to-Video**: Animate a reference image into motion
- **Avatar Mode**: Create professional talking head videos

### Step 2: Write Your Prompt

Enter a detailed description of your video. Be specific about:
- Visual style and mood
- Camera movements (slow pan, tracking shot, etc.)
- Lighting conditions (golden hour, dramatic shadows)
- Subject actions and emotions

**Example prompt:**
> "A woman in a red dress walks through a neon-lit Tokyo street at night, cinematic lighting, slow tracking shot, rain reflections on pavement"

### Step 3: Configure Settings

- **Clip Count**: Choose 1-20 clips (each 5-10 seconds)
- **Clip Duration**: 5 seconds (10 credits) or 10 seconds (15 credits)
- **Aspect Ratio**: 16:9 (landscape), 9:16 (portrait/mobile), or 1:1 (square)
- **Narration**: Enable AI voiceover (optional)
- **Music**: Add background music (optional)

### Step 4: Generate & Monitor

Click **"Generate Video"** to start production. Track progress on the Production page:
- Watch individual clips render in real-time
- Preview completed clips immediately
- Regenerate any unsatisfactory clips

### Step 5: Download & Share

Once complete, download your video or share directly. Options include:
- **Download All**: Merged video with audio
- **Download Clips**: Individual segments
- **Share Link**: Public sharing URL

> **Pro Tip**: Start with 1-2 clips to test your prompt before committing to longer projects.
        `
      },
      {
        id: 'understanding-credits',
        title: 'Understanding Credits',
        description: 'How credits work and our pricing model',
        readTime: '4 min',
        popular: true,
        content: `
## Understanding Credits

Credits power all video generation on Apex Studio.

### Credit Pricing

| Clip Type | Duration | Credits | Cost |
|-----------|----------|---------|------|
| Standard | ≤6 seconds | 10 | $1.00 |
| Extended | >6 seconds | 15 | $1.50 |

**1 credit = $0.10 USD**

### Getting Started
- **No Expiration**: Credits never expire while your account is active
- **No Subscriptions**: Buy once, use whenever
- **Pay As You Go**: Purchase credits in affordable packages

### Credit Packages

| Package | Credits | Price | Best For |
|---------|---------|-------|----------|
| Starter | 370 | $37 | Testing |
| Growth | 1,000 | $100 | Regular creators |
| Agency | 2,500 | $250 | Teams & studios |

### ⚠️ Important: No Refunds

**All credit purchases are final and non-refundable.**

- Start with the smallest package to test
- Budget 2-4x credits for regenerations
- AI results vary—this is normal

### Credit-Saving Tips

1. **Start short**: Test with 5-second clips (10 vs 15 credits)
2. **Review scripts**: Fix typos before generating
3. **Use reference images**: Better consistency = fewer regenerations
4. **Check prompts**: Clear descriptions reduce unexpected results
        `
      },
      {
        id: 'workspace-overview',
        title: 'Workspace Overview',
        description: 'Navigate the Apex interface like a pro',
        readTime: '4 min',
        content: `
## Workspace Overview

Master the Apex Studio interface for maximum productivity.

### Main Navigation

| Section | Purpose |
|---------|---------|
| **Create** | Text-to-video generation studio |
| **Avatars** | Talking head video creation |
| **Projects** | Your video library |
| **Clips** | Individual clip gallery |
| **Discover** | Community content feed |
| **Creators** | Find and follow other creators |

### Project Dashboard

Your **Projects** page displays:
- All video projects with thumbnails
- Status indicators (generating, ready, failed)
- Quick actions (play, download, delete)
- Filter by status or date

### Profile & Settings

Access via your avatar menu:
- **Profile**: Display name, avatar, bio
- **Settings**: Billing, preferences, data export
- **Help Center**: Documentation & support

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| \`Space\` | Play/Pause video |
| \`Esc\` | Close modal |
| \`↑/↓\` | Volume control |
| \`←/→\` | Seek video |
        `
      },
      {
        id: 'quick-tips',
        title: 'Quick Tips for Better Videos',
        description: 'Expert advice for professional results',
        readTime: '6 min',
        popular: true,
        content: `
## Quick Tips for Better Videos

### Writing Effective Prompts

**DO:**
- Be specific: "close-up shot of hands typing on keyboard"
- Describe lighting: "soft golden hour light through window"
- Include motion: "slow dolly forward toward subject"
- Set mood: "peaceful, serene atmosphere"

**DON'T:**
- Be vague: "person doing something"
- Request text: AI cannot reliably render readable text
- Expect perfection: Plan for 2-3 regenerations

### Maintaining Visual Consistency

1. **Use reference images**: Upload a starting image for consistent style
2. **Keep descriptions consistent**: Same character details across all clips
3. **Match lighting**: Describe similar lighting in each scene
4. **Limit scene changes**: Fewer locations = better continuity

### Optimizing for Different Platforms

| Platform | Aspect Ratio | Duration |
|----------|--------------|----------|
| YouTube | 16:9 | 30-60s |
| TikTok/Reels | 9:16 | 15-30s |
| Instagram | 1:1 or 9:16 | 15-30s |
| LinkedIn | 16:9 | 30-60s |

### Common Mistakes to Avoid

- **Requesting text overlays**: Use editing software instead
- **Complex multi-character scenes**: AI struggles with interactions
- **Rapid action sequences**: Slower movements render better
- **Expecting photorealism**: Embrace the AI aesthetic
        `
      }
    ]
  },
  {
    id: 'video-creation',
    title: 'Video Creation Modes',
    description: 'Master all video generation methods',
    icon: Video,
    color: 'from-blue-500 to-indigo-500',
    articles: [
      {
        id: 'text-to-video',
        title: 'Text-to-Video Creation',
        description: 'Generate videos from text descriptions',
        readTime: '6 min',
        popular: true,
        content: `
## Text-to-Video Creation

Transform written descriptions into stunning AI-generated video content.

### How It Works

1. **Enter your prompt** describing the desired video
2. **AI analyzes** your description for visual elements
3. **Kling AI renders** each clip based on your specifications
4. **Review & regenerate** any clips as needed
5. **Download** your finished video

### Writing Effective Prompts

**Structure your prompt:**
\`\`\`
[SUBJECT] + [ACTION] + [ENVIRONMENT] + [STYLE] + [CAMERA]
\`\`\`

**Example:**
> "A young woman with long dark hair walks through a misty forest at dawn, cinematic film look, slow tracking shot following from behind"

### Prompt Components

| Component | Examples |
|-----------|----------|
| **Subject** | "A man in a suit", "A golden retriever", "Futuristic cityscape" |
| **Action** | "walking slowly", "turning to face camera", "rain falling" |
| **Environment** | "in a cozy coffee shop", "on a mountain peak", "underwater" |
| **Style** | "cinematic", "anime-style", "vintage film grain" |
| **Camera** | "slow pan left", "close-up", "aerial drone shot" |

### Configuration Options

- **Clip Count**: 1-20 clips per project
- **Duration**: 5 seconds (recommended) or 10 seconds
- **Aspect Ratio**: 16:9, 9:16, or 1:1
- **Narration**: AI voiceover from your script
- **Music**: Auto-generated background music

### Best Practices

✅ Start with single clips to test prompts
✅ Use simple, clear descriptions
✅ Describe camera movement explicitly
✅ Include lighting and mood details

❌ Avoid complex character interactions
❌ Don't request readable text
❌ Skip rapid motion sequences
        `
      },
      {
        id: 'image-to-video',
        title: 'Image-to-Video Animation',
        description: 'Bring still images to life with AI animation',
        readTime: '5 min',
        content: `
## Image-to-Video Animation

Animate your photos and images into dynamic video content.

### Getting Started

1. **Upload your image** via the Create page
2. **Describe the motion** you want to see
3. **Choose duration** (5 or 10 seconds)
4. **Generate** and watch your image come alive

### Supported Image Types

- **Photographs**: Real photos, portraits, landscapes
- **Digital Art**: Illustrations, paintings, renders
- **AI-Generated Images**: From Midjourney, DALL-E, etc.
- **Screenshots**: Product shots, UI mockups

### Motion Prompt Tips

Your prompt describes **what moves**, not what the image contains:

**Good prompts:**
- "Gentle breeze moves the hair, soft eye blink"
- "Camera slowly zooms in on the subject"
- "Clouds drift across the sky, water ripples"
- "Person turns head slightly toward camera"

**Bad prompts:**
- "A woman standing in a field" (describes image, not motion)
- "Make it look better" (too vague)

### Animation Styles

| Style | Description | Best For |
|-------|-------------|----------|
| **Subtle** | Gentle movements, breathing effects | Portraits, art |
| **Dynamic** | Active motion, transformations | Action scenes |
| **Cinematic** | Camera movements, depth effects | Landscapes, scenes |

### Technical Requirements

- **Format**: JPG, PNG, WebP
- **Resolution**: Minimum 512x512, maximum 4096x4096
- **Aspect Ratio**: Preserved from source image
        `
      },
      {
        id: 'avatar-videos',
        title: 'Avatar Video Creation',
        description: 'Create professional talking head videos',
        readTime: '8 min',
        popular: true,
        content: `
## Avatar Video Creation

Create realistic talking head videos with AI avatars and your custom scripts.

### What Are Avatar Videos?

Avatar videos feature AI-generated presenters who speak your script with natural lip-sync, expressions, and gestures. Perfect for:
- Training & educational content
- Marketing videos
- Social media content
- Explainer videos
- Personalized messages

### Creating Your First Avatar Video

1. **Navigate to Avatars** from the main menu
2. **Browse the avatar library** and select a presenter
3. **Write your script** (what the avatar will say)
4. **Choose a voice** matching your avatar
5. **Configure settings** (duration, background)
6. **Generate** your video

### Avatar Library

Our library includes diverse avatars:
- **Professional**: Business presenters, executives
- **Casual**: Friendly, approachable hosts
- **Creative**: Artists, influencers, creators
- **Realistic**: Photo-realistic human avatars
- **Stylized**: Animated, artistic styles

### Voice Selection

Each avatar can use various AI voices:
- Match voice to avatar appearance
- Multiple languages available
- Adjust speaking speed and tone
- Preview voices before generating

### Script Best Practices

**Writing for avatars:**
- Keep sentences concise (5-15 words)
- Use natural, conversational language
- Include punctuation for proper pacing
- Avoid technical jargon unless necessary

**Example script:**
> "Hi! I'm here to show you how easy it is to create AI videos. In just a few clicks, you'll have professional content ready to share."

### Advanced Features

- **Custom Backgrounds**: Upload your own backdrop
- **Multi-Clip Projects**: Link multiple segments
- **Scene Environments**: Choose preset locations
- **Emotional Tones**: Happy, serious, excited moods
        `
      },
      {
        id: 'script-writing',
        title: 'Writing Effective Scripts',
        description: 'Craft compelling scripts for AI generation',
        readTime: '7 min',
        content: `
## Writing Effective Scripts

Great AI videos start with well-crafted scripts and prompts.

### Script Structure

Break content into clear visual scenes:

\`\`\`
CLIP 1: Opening Hook (5 seconds)
- Wide establishing shot of city skyline at sunset
- Dramatic lighting, golden hour glow

CLIP 2: Introduction (5 seconds)
- Medium shot of presenter in modern office
- Professional lighting, shallow depth of field

CLIP 3: Main Content (10 seconds)
- Close-up of product being demonstrated
- Clean white background, soft shadows
\`\`\`

### Visual Description Guidelines

**Camera Terms:**
- Wide shot, medium shot, close-up
- Slow pan, tracking shot, static
- Low angle, high angle, eye level
- Dolly in, pull back, crane shot

**Lighting Terms:**
- Golden hour, blue hour
- Soft diffused, hard shadows
- Backlit, rim light
- Natural, artificial, neon

**Style Terms:**
- Cinematic, documentary, commercial
- Film grain, sharp digital
- Warm palette, cool tones
- Moody, bright, dramatic

### Pacing Guidelines

| Section | Duration | Purpose |
|---------|----------|---------|
| Hook | 3-5s | Grab attention |
| Intro | 5-10s | Set context |
| Body | Variable | Main content |
| CTA | 5-10s | Call to action |

### Common Script Mistakes

❌ **Too vague**: "A nice scene with people"
✅ **Specific**: "Three friends laughing at a café table, warm afternoon light"

❌ **Too complex**: "Multiple characters having a conversation while walking"
✅ **Simpler**: "Two people walking side by side, smiling"

❌ **Expecting text**: "Show text saying 'Welcome!'"
✅ **Alternative**: Add text in editing software post-production
        `
      },
      {
        id: 'character-consistency',
        title: 'Character Consistency',
        description: 'Keep characters looking the same across scenes',
        readTime: '6 min',
        content: `
## Character Consistency

Maintaining character appearance across multiple clips is challenging with AI. Here's how to maximize consistency.

### Using Reference Images

The **most effective method** for consistency:

1. Upload a reference image when creating your project
2. The AI anchors character appearance to this image
3. Use the same reference across all clips in a project

### Detailed Descriptions

Be extremely specific and consistent:

**Good character description:**
> "A woman in her 30s with shoulder-length auburn hair, green eyes, fair skin with light freckles, wearing a navy blue blazer over a white blouse"

**Use this EXACT description in every clip** of the project.

### Consistency Factors

| Factor | Impact | Tip |
|--------|--------|-----|
| Face | High | Describe key features |
| Hair | High | Exact color and style |
| Clothing | Medium | Consistent outfit |
| Lighting | Medium | Match across scenes |
| Environment | Low | Can vary more freely |

### Reality Check

**AI limitations mean:**
- Characters may shift slightly between clips
- Exact matches are not guaranteed
- Some regeneration is normal
- Perfect consistency requires editing software

### Workarounds

1. **Shorter projects**: Fewer clips = less drift
2. **Static shots**: Less motion = better consistency
3. **Post-editing**: Color grade to unify look
4. **Accept variation**: Embrace AI's artistic interpretation
        `
      }
    ]
  },
  {
    id: 'production-workflow',
    title: 'Production Workflow',
    description: 'From creation to final export',
    icon: Play,
    color: 'from-purple-500 to-violet-500',
    articles: [
      {
        id: 'production-monitor',
        title: 'Understanding the Production Monitor',
        description: 'Track your video generation in real-time',
        readTime: '5 min',
        popular: true,
        content: `
## Understanding the Production Monitor

The Production page shows real-time progress of your video generation.

### Production Stages

| Stage | Description | Duration |
|-------|-------------|----------|
| **Initializing** | Setting up project | ~5 seconds |
| **Generating** | AI rendering clips | 1-3 min per clip |
| **Processing** | Finalizing assets | ~30 seconds |
| **Ready** | Complete! | - |

### Reading the Interface

**Progress Bar**: Overall completion percentage
**Clip Grid**: Visual status of each clip
**Status Indicators**:
- 🔵 Pending (queued)
- 🟡 Generating (in progress)
- 🟢 Completed (ready)
- 🔴 Failed (needs regeneration)

### Clip Actions

For each completed clip:
- **Preview**: Watch the clip
- **Regenerate**: Try again with same prompt
- **Download**: Save individual clip

### Handling Failures

If a clip fails:
1. Click **"Retry"** to regenerate
2. If repeated failures, try simplifying the prompt
3. Contact support if issues persist

### Time Estimates

| Clips | 5-Second Each | 10-Second Each |
|-------|---------------|----------------|
| 1-2 | ~3-5 minutes | ~5-8 minutes |
| 3-5 | ~8-12 minutes | ~12-18 minutes |
| 6-10 | ~15-25 minutes | ~25-40 minutes |

> **Note**: Times vary based on server load and prompt complexity.
        `
      },
      {
        id: 'regenerating-clips',
        title: 'Regenerating Clips',
        description: 'How to redo unsatisfactory clips',
        readTime: '4 min',
        content: `
## Regenerating Clips

Not happy with a clip? Here's how to regenerate.

### When to Regenerate

**Good reasons:**
- Visual artifacts or glitches
- Subject doesn't match description
- Camera movement is wrong
- Overall quality is poor

**Consider NOT regenerating:**
- Minor imperfections
- Slight character variations (normal for AI)
- "Not exactly what I imagined" (try adjusting expectations)

### How to Regenerate

1. Find the clip in your Production view
2. Click the **refresh/retry** icon
3. Wait for regeneration (same time as original)
4. Review the new result

### Regeneration Costs

**Each regeneration costs credits:**
- 5-second clip: 10 credits
- 10-second clip: 15 credits

**Budget accordingly!** Plan for 2-4x credits for regenerations.

### Improving Regeneration Results

If regenerating repeatedly:
1. **Simplify the prompt**: Remove complex elements
2. **Be more specific**: Add clearer descriptions
3. **Reduce action**: Slower movements render better
4. **Check reference image**: Ensure it's high quality
        `
      },
      {
        id: 'downloading-videos',
        title: 'Downloading Your Videos',
        description: 'Export options and formats',
        readTime: '4 min',
        content: `
## Downloading Your Videos

Multiple options for exporting your completed videos.

### Download Options

**Download All (Merged)**
- Single video file with all clips combined
- Includes audio (narration + music if enabled)
- Processed in-browser for privacy
- MP4 format

**Download Individual Clips**
- Save specific clips separately
- Useful for editing in external software
- No audio merging—clips only

### Technical Specifications

| Property | Value |
|----------|-------|
| Format | MP4 (H.264) |
| Resolution | Up to 1080p |
| Frame Rate | 24-30 fps |
| Audio | AAC stereo |

### Browser Compatibility

**Full support (merged downloads):**
- Chrome, Edge, Firefox (desktop)
- Chrome for Android

**Limited support:**
- Safari (individual clips only)
- iOS browsers (individual clips only)

> **iOS/Safari users**: Download individual clips and merge using video editing apps.

### Download Troubleshooting

**Download not starting?**
- Check popup blocker settings
- Try a different browser
- Ensure stable internet connection

**Merged video missing audio?**
- Verify narration/music was enabled
- Try re-downloading
- Download clips separately and merge externally
        `
      },
      {
        id: 'sharing-videos',
        title: 'Sharing Your Videos',
        description: 'Public sharing and social features',
        readTime: '3 min',
        content: `
## Sharing Your Videos

Share your creations with the Apex community and beyond.

### Making Videos Public

1. Go to your **Projects** page
2. Find the completed video
3. Toggle **"Make Public"** or use the share icon
4. Copy the shareable link

### Public Gallery

Public videos appear in:
- **Discover** feed for other users
- Your public profile page
- Gallery showcase (featured content)

### Social Features

**Interactions:**
- ❤️ Likes from community members
- 💬 Comments and discussions
- 👤 Follower/Following system
- 📤 Direct sharing options

### Privacy Controls

| Setting | Visibility |
|---------|------------|
| **Private** | Only you can see |
| **Public** | Anyone with link + feed |

### Best Practices

- Add descriptive titles
- Write engaging descriptions
- Use relevant tags (if available)
- Engage with community feedback
        `
      }
    ]
  },
  {
    id: 'billing-credits',
    title: 'Billing & Credits',
    description: 'Pricing, payments, and refund policy',
    icon: CreditCard,
    color: 'from-amber-500 to-orange-500',
    articles: [
      {
        id: 'credit-pricing',
        title: 'Credit Pricing & Packages',
        description: 'Detailed pricing breakdown',
        readTime: '4 min',
        content: `
## Credit Pricing & Packages

Apex Studio uses a credit-based system (no subscriptions).

### Credit Value

**1 credit = $0.10 USD**

### Video Generation Costs

| Clip Duration | Credits | USD Cost |
|---------------|---------|----------|
| ≤6 seconds | 10 | $1.00 |
| >6 seconds | 15 | $1.50 |

### Credit Packages

| Package | Credits | Price | Per Credit |
|---------|---------|-------|------------|
| Starter | 370 | $37 | $0.10 |
| Growth | 1,000 | $100 | $0.10 |
| Agency | 2,500 | $250 | $0.10 |

### Getting Started

All credits are purchased via credit packages.

- No expiration while account is active
- Non-refundable, non-transferable
- Start with the Mini or Starter package to test

### Why Credits?

- **No monthly fees**: Pay only when you create
- **No expiration**: Use at your own pace
- **Predictable costs**: Know exactly what you're spending
- **Fair pricing**: Same rate for everyone
        `
      },
      {
        id: 'payment-methods',
        title: 'Payment Methods',
        description: 'How to purchase credits',
        readTime: '2 min',
        content: `
## Payment Methods

All payments processed securely through Stripe.

### Accepted Methods

- **Credit/Debit Cards**: Visa, Mastercard, American Express, Discover
- **Digital Wallets**: Apple Pay, Google Pay
- **Link by Stripe**: Fast checkout with saved payment

### Payment Security

✅ PCI-DSS Level 1 compliant
✅ End-to-end encryption
✅ We never store full card numbers
✅ Secure payment processing

### Purchasing Credits

1. Go to **Settings → Billing**
2. Select a credit package
3. Complete checkout via Stripe
4. Credits added instantly

### Receipts

- Emailed automatically after purchase
- Available in Settings → Billing → Transaction History
- Downloadable for business expenses
        `
      },
      {
        id: 'refund-policy',
        title: 'Refund Policy',
        description: 'Important: All sales are final',
        readTime: '3 min',
        popular: true,
        content: `
## Refund Policy

### ⚠️ ALL SALES ARE FINAL

**Credit purchases are non-refundable under any circumstances.**

### What This Means

You **cannot** get a refund for:
- Unused credits in your account
- Dissatisfaction with AI-generated results
- Account closure or suspension
- Service changes or updates
- "Changed my mind" requests

### Why This Policy?

1. **AI costs are incurred immediately** when you generate content
2. **Credits allocate server resources** upon purchase
3. **Competitive pricing** is possible because of this policy
4. **Industry standard** for AI generation services

### Before You Buy

**Protect yourself:**

1. ✅ Start with the **smallest package** to test thoroughly
2. ✅ Review our **AI limitations** documentation
3. ✅ Watch **sample videos** in the gallery
4. ✅ Start with the **smallest package** if unsure
5. ✅ Understand that **regeneration is normal**

### Questions?

Contact **cole@apex-studio.com** BEFORE purchasing if you have concerns.
        `
      }
    ]
  },
  {
    id: 'account-security',
    title: 'Account & Security',
    description: 'Manage your account and data',
    icon: Shield,
    color: 'from-rose-500 to-pink-500',
    articles: [
      {
        id: 'account-settings',
        title: 'Account Settings',
        description: 'Update profile and preferences',
        readTime: '3 min',
        content: `
## Account Settings

### Profile Information

Update your public profile:
1. Click your avatar → **Profile**
2. Edit display name, avatar, bio
3. Click **Save Changes**

### Email Preferences

Control notifications:
- Project completion alerts
- Community activity
- Product updates
- Tips and tutorials

### Settings Navigation

| Section | Contents |
|---------|----------|
| **Profile** | Name, avatar, bio |
| **Billing** | Credits, transactions, packages |
| **Privacy** | Data export, account deletion |
| **Preferences** | Notifications, defaults |
        `
      },
      {
        id: 'data-privacy',
        title: 'Data & Privacy',
        description: 'Your data rights and controls',
        readTime: '4 min',
        content: `
## Data & Privacy

### What We Store

- Account information (email, name)
- Generated videos and projects
- Usage analytics (anonymized)
- Payment history

### Your Rights

✅ **Access**: Download your data anytime
✅ **Export**: Request full data export
✅ **Delete**: Remove your account and data
✅ **Opt-out**: Control analytics and emails

### Data Export

1. Settings → Privacy
2. Click **"Export My Data"**
3. Receive download link via email (within 24 hours)

### Account Deletion

1. Settings → Privacy
2. Click **"Delete Account"**
3. Confirm deletion
4. 30-day grace period before permanent removal

### GDPR Compliance

We're fully GDPR compliant. Contact **cole@apex-studio.com** for data requests.
        `
      }
    ]
  },
  {
    id: 'ai-limitations',
    title: 'AI Technology & Limitations',
    description: 'Understand what AI can and cannot do',
    icon: Lightbulb,
    color: 'from-yellow-500 to-amber-500',
    articles: [
      {
        id: 'understanding-ai',
        title: 'Understanding AI Video Generation',
        description: 'How our technology works and what to expect',
        readTime: '6 min',
        popular: true,
        content: `
## Understanding AI Video Generation

### How It Works

Apex Studio uses advanced AI services to transform your text and images into video:

1. **Your input** (text/image) is processed
2. **AI models** interpret your description
3. **Kling AI** renders the video frames
4. **Post-processing** enhances quality
5. **Your video** is delivered

### Technology Stack

| Service | Purpose |
|---------|---------|
| **Kling AI** | Primary video synthesis |
| **OpenAI** | Script enhancement |
| **ElevenLabs** | Voice synthesis |

### ⚠️ Critical Limitations

**Before purchasing, understand these AI constraints:**

### AI "Hallucinations"

AI frequently produces unexpected results. This is **normal**, not a bug:
- Characters may look different between scenes
- Objects may appear, disappear, or transform
- Hands, faces often contain artifacts
- Physics may not behave realistically
- Text in videos is usually illegible
- Actions may not match descriptions exactly

### Regeneration Is Expected

- Plan to regenerate clips 2-4 times
- Budget extra credits accordingly
- Some prompts may never produce satisfactory results
- Perfect results are not guaranteed

### Third-Party Dependencies

Our video generation relies on external services that may:
- Experience downtime
- Have content restrictions
- Change capabilities without notice

### Your Responsibilities

1. **Review all content** before publishing
2. **Never rely on AI** for factual accuracy
3. **Budget for regeneration**—this is expected
4. **Start with a small package** to understand the platform
5. **Accept inherent limitations** of current AI technology
        `
      },
      {
        id: 'content-restrictions',
        title: 'Content Restrictions',
        description: 'What content is prohibited',
        readTime: '3 min',
        content: `
## Content Restrictions

### Prohibited Content

The following content is **not allowed**:

❌ Pornographic or sexually explicit material
❌ Violence, gore, or disturbing imagery
❌ Hate speech or discriminatory content
❌ Content depicting real people without consent
❌ Illegal activities or drug use
❌ Misinformation or deepfakes intended to deceive
❌ Copyright-infringing material
❌ Content harmful to minors

### AI Content Filters

Our AI systems automatically filter:
- Explicit content requests
- Violence-related prompts
- Certain sensitive topics

Attempts to bypass filters may result in account suspension.

### Reporting Violations

Report inappropriate content: **cole@apex-studio.com**
        `
      },
      {
        id: 'accuracy-disclaimer',
        title: 'Content Accuracy Disclaimer',
        description: 'AI cannot guarantee accuracy',
        readTime: '3 min',
        content: `
## Content Accuracy Disclaimer

### No Guarantee of Accuracy

AI-generated content may contain:
- Visual inaccuracies or artifacts
- Inconsistencies with your prompts
- Unexpected interpretations
- Unrealistic elements
- Factual errors in any text

### Your Responsibility

**You are responsible for:**
- Reviewing all generated content
- Verifying accuracy before publishing
- Ensuring content meets your standards
- Compliance with applicable laws
- Not representing AI content as human-created (if required)

### When to Regenerate

Consider regenerating if:
- Characters look significantly different
- Actions don't match descriptions
- Visual quality is below acceptable standards
- Unintended or inappropriate elements appear

### Final Review

**Always watch your complete video before:**
- Downloading for distribution
- Sharing publicly
- Using commercially
- Publishing anywhere
        `
      }
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Common issues and solutions',
    icon: Settings,
    color: 'from-gray-500 to-slate-500',
    articles: [
      {
        id: 'video-not-playing',
        title: 'Video Not Playing',
        description: 'Fix playback issues',
        readTime: '3 min',
        content: `
## Video Not Playing

### Quick Fixes

1. **Refresh the page** (Ctrl/Cmd + R)
2. **Try a different browser** (Chrome recommended)
3. **Check internet connection**
4. **Clear browser cache**

### Browser-Specific Issues

**Safari:**
- Some features limited on Safari
- Try Chrome or Firefox for full support

**Mobile:**
- Ensure sufficient storage space
- Try on WiFi instead of cellular

### Video Shows Black Screen

- Wait a few seconds—loading may be slow
- Check if video is still generating
- Try clicking the play button manually

### Audio Not Working

- Check device volume
- Unmute the video player
- Verify narration was enabled during creation
        `
      },
      {
        id: 'generation-stuck',
        title: 'Generation Stuck or Failed',
        description: 'Resolve generation issues',
        readTime: '4 min',
        content: `
## Generation Stuck or Failed

### If Generation Is Stuck

**Wait it out:**
- Complex videos can take 15-30+ minutes
- Check the progress indicator
- Don't refresh during generation

**If truly stuck (>1 hour):**
1. Refresh the page
2. Check the Projects page—it may have completed
3. Contact support if issue persists

### If Generation Failed

**Common causes:**
- Content filtered by safety systems
- Server overload (try again later)
- Complex prompt the AI couldn't interpret

**Solutions:**
1. **Simplify your prompt**
2. **Reduce clip count**
3. **Try different wording**
4. **Wait and retry**

### Credits and Failures

**Failed generations:**
- Credits are only charged for successful clips
- Partial completions charge for completed clips only
- Contact support for billing issues
        `
      },
      {
        id: 'account-issues',
        title: 'Account & Login Issues',
        description: 'Access and authentication problems',
        readTime: '3 min',
        content: `
## Account & Login Issues

### Can't Log In

1. **Check email address** for typos
2. **Reset password** via "Forgot Password"
3. **Check spam folder** for reset email
4. **Try incognito/private browsing**

### Account Locked

If you see "account locked" or "too many attempts":
- Wait 15-30 minutes
- Try password reset
- Contact support if persistent

### Email Verification

**Not receiving verification email?**
1. Check spam/junk folder
2. Add our email to contacts
3. Request new verification email
4. Try a different email address

### Two Accounts

If you accidentally created multiple accounts:
- Credits cannot be merged
- Contact support to close duplicates
- Keep the account with credits/projects
        `
      },
      {
        id: 'contact-support',
        title: 'Contacting Support',
        description: 'How to get help',
        readTime: '2 min',
        content: `
## Contacting Support

### Email Support

**cole@apex-studio.com**

Include in your message:
- Your account email
- Project ID (if applicable)
- Clear description of the issue
- Screenshots if helpful

### Response Time

- Typical response: 24-48 hours
- Complex issues may take longer
- No weekend/holiday support

### Before Contacting

Check this Help Center first:
- Search for your issue
- Review troubleshooting guides
- Check AI limitations documentation

Many issues are covered here and can be resolved immediately!
        `
      }
    ]
  }
];

// Flatten all articles for search
const ALL_ARTICLES = HELP_CATEGORIES.flatMap(cat => 
  cat.articles.map(article => ({
    ...article,
    category: cat.title,
    categoryId: cat.id,
    categoryColor: cat.color
  }))
);

// Article content component - wrapped with forwardRef for AnimatePresence compatibility
const ArticleContent = forwardRef<HTMLDivElement, { article: typeof ALL_ARTICLES[0]; onBack: () => void }>(
  function ArticleContent({ article, onBack }, ref) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="max-w-3xl mx-auto"
      >
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 text-muted-foreground hover:text-foreground hover:bg-muted/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Help Center
        </Button>

        <div className="p-8 rounded-3xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <Badge 
              className="bg-muted text-muted-foreground border-0"
            >
              {article.category}
            </Badge>
            <span className="text-muted-foreground/60 text-sm flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {article.readTime}
            </span>
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
            {article.title}
          </h1>
          
          <SafeMarkdownRenderer 
            content={article.content}
            className="prose prose-invert max-w-none"
          />
        </div>
      </motion.div>
    );
  }
);

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<typeof ALL_ARTICLES[0] | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('getting-started');

  // Filter articles based on search
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return ALL_ARTICLES.filter(article =>
      article.title.toLowerCase().includes(query) ||
      article.description.toLowerCase().includes(query) ||
      article.content.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Popular articles
  const popularArticles = ALL_ARTICLES.filter(a => a.popular);

  return (
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      {/* Abstract Background */}
      <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <span className="text-sm font-bold text-black">A</span>
            </div>
            <span className="text-base font-semibold text-white tracking-tight">Apex Studio</span>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatePresence mode="wait">
            {selectedArticle ? (
              <ArticleContent 
                key="article"
                article={selectedArticle} 
                onBack={() => setSelectedArticle(null)} 
              />
            ) : (
              <motion.div
                key="main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-12"
                >
                  <Link 
                    to="/" 
                    className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                  </Link>
                  
                  <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Help Center</h1>
                  <p className="text-lg text-white/40 max-w-2xl mx-auto mb-8">
                    Find answers, learn best practices, and get the most out of Apex Studio
                  </p>

                  {/* Search */}
                  <div className="relative max-w-xl mx-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      placeholder="Search for help..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-14 pl-12 pr-4 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 rounded-2xl focus:border-white/20 focus:ring-0"
                    />
                  </div>
                </motion.div>

                {/* Search Results */}
                {searchQuery && filteredArticles.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12"
                  >
                    <h2 className="text-lg font-semibold text-white mb-4">
                      Search Results ({filteredArticles.length})
                    </h2>
                    <div className="grid gap-3">
                      {filteredArticles.map(article => (
                        <button
                          key={article.id}
                          onClick={() => {
                            setSelectedArticle(article);
                            setSearchQuery('');
                          }}
                          className="group w-full text-left p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge className="mb-2 bg-white/10 text-white/50 border-0 text-xs">
                                {article.category}
                              </Badge>
                              <h3 className="text-white font-medium group-hover:text-white/90">
                                {article.title}
                              </h3>
                              <p className="text-white/40 text-sm mt-1">{article.description}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white/40 transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {searchQuery && filteredArticles.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 mb-12"
                  >
                    <HelpCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40">No results found for "{searchQuery}"</p>
                    <p className="text-white/30 text-sm mt-2">Try different keywords or browse categories below</p>
                  </motion.div>
                )}

                {/* Popular Articles */}
                {!searchQuery && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-12"
                  >
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Star className="w-5 h-5 text-warning" />
                      Popular Articles
                    </h2>
                    <div className="grid md:grid-cols-2 gap-3">
                      {popularArticles.map(article => (
                        <button
                          key={article.id}
                          onClick={() => setSelectedArticle(article)}
                          className="group text-left p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-white font-medium group-hover:text-white/90">
                                {article.title}
                              </h3>
                              <p className="text-white/40 text-sm mt-1">{article.description}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white/40 flex-shrink-0 ml-4" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Categories */}
                {!searchQuery && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2 className="text-lg font-semibold text-white mb-4">Browse by Category</h2>
                    <div className="space-y-3">
                      {HELP_CATEGORIES.map(category => {
                        const Icon = category.icon;
                        const isExpanded = expandedCategory === category.id;
                        
                        return (
                          <div 
                            key={category.id}
                            className="rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden"
                          >
                            <button
                              onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                              className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
                                  category.color
                                )}>
                                  <Icon className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-left">
                                  <h3 className="text-white font-medium">{category.title}</h3>
                                  <p className="text-white/40 text-sm">{category.description}</p>
                                </div>
                              </div>
                              <ChevronDown className={cn(
                                "w-5 h-5 text-white/30 transition-transform",
                                isExpanded && "rotate-180"
                              )} />
                            </button>
                            
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-5 pb-5 space-y-2">
                                    {category.articles.map(article => (
                                      <button
                                        key={article.id}
                                        onClick={() => setSelectedArticle({
                                          ...article,
                                          category: category.title,
                                          categoryId: category.id,
                                          categoryColor: category.color
                                        })}
                                        className="group w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                                      >
                                        <div className="flex items-center gap-3">
                                          <FileText className="w-4 h-4 text-white/30" />
                                          <span className="text-white/70 group-hover:text-white transition-colors">
                                            {article.title}
                                          </span>
                                          {article.popular && (
                                            <Badge className="bg-warning/20 text-warning border-0 text-xs">
                                              Popular
                                            </Badge>
                                          )}
                                        </div>
                                        <span className="text-white/30 text-sm">{article.readTime}</span>
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Contact Support */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-12 p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] text-center"
                >
                  <MessageCircle className="w-10 h-10 text-white/30 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-white mb-2">Still need help?</h2>
                  <p className="text-white/40 mb-6">
                    Our support team is ready to assist you with any questions
                  </p>
                  <Button
                    asChild
                    className="bg-white text-black hover:bg-white/90 rounded-full"
                  >
                    <a href="mailto:cole@apex-studio.com">
                      Contact Support
                      <ArrowUpRight className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
