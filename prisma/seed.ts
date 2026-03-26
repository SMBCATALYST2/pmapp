// prisma/seed.ts
// Database seed script for PMApp
//
// Seeds a demo workspace with:
// - 1 demo user (demo@pmapp.dev / password123)
// - 1 workspace ("Acme Corp")
// - 1 project ("PMApp" with prefix "PM")
// - 6 workflow statuses (Backlog, Todo, In Progress, In Review, Done, Cancelled)
// - 4 labels (Bug, Feature, Enhancement, Documentation)
// - 15 sample issues across statuses
//
// Run: bunx prisma db seed

import { PrismaClient, IssueType, Priority, StatusCategory } from '../generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ------------------------------------------------------------------
  // 1. Create demo user
  // ------------------------------------------------------------------
  const hashedPassword = await bcrypt.hash('password123', 12);

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@pmapp.dev' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@pmapp.dev',
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  const secondUser = await prisma.user.upsert({
    where: { email: 'jane@pmapp.dev' },
    update: {},
    create: {
      name: 'Jane Smith',
      email: 'jane@pmapp.dev',
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  console.log(`  Created users: ${demoUser.email}, ${secondUser.email}`);

  // ------------------------------------------------------------------
  // 2. Create demo workspace
  // ------------------------------------------------------------------
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      description: 'Demo workspace for PMApp',
      ownerId: demoUser.id,
    },
  });

  // Add members
  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: { userId: demoUser.id, workspaceId: workspace.id },
    },
    update: {},
    create: {
      userId: demoUser.id,
      workspaceId: workspace.id,
      role: 'OWNER',
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: { userId: secondUser.id, workspaceId: workspace.id },
    },
    update: {},
    create: {
      userId: secondUser.id,
      workspaceId: workspace.id,
      role: 'MEMBER',
    },
  });

  console.log(`  Created workspace: ${workspace.name} (${workspace.slug})`);

  // ------------------------------------------------------------------
  // 3. Create demo project
  // ------------------------------------------------------------------
  let project = await prisma.project.findFirst({
    where: { workspaceId: workspace.id, prefix: 'PM' },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'PMApp',
        prefix: 'PM',
        description: 'Project management application — building a JIRA alternative',
        icon: '🚀',
        color: '#3B82F6',
        workspaceId: workspace.id,
        leadId: demoUser.id,
        issueCounter: 0,
      },
    });
  }

  console.log(`  Created project: ${project.name} (${project.prefix})`);

  // ------------------------------------------------------------------
  // 4. Create workflow statuses
  // ------------------------------------------------------------------
  const statusDefinitions = [
    { name: 'Backlog', category: StatusCategory.BACKLOG, color: '#6B7280', position: 0 },
    { name: 'Todo', category: StatusCategory.TODO, color: '#3B82F6', position: 1 },
    { name: 'In Progress', category: StatusCategory.IN_PROGRESS, color: '#F59E0B', position: 2 },
    { name: 'In Review', category: StatusCategory.IN_PROGRESS, color: '#8B5CF6', position: 3 },
    { name: 'Done', category: StatusCategory.DONE, color: '#10B981', position: 4 },
    { name: 'Cancelled', category: StatusCategory.CANCELLED, color: '#EF4444', position: 5 },
  ];

  const statuses: Record<string, { id: string }> = {};

  for (const def of statusDefinitions) {
    const status = await prisma.workflowStatus.upsert({
      where: {
        projectId_name: { projectId: project.id, name: def.name },
      },
      update: {},
      create: {
        ...def,
        projectId: project.id,
      },
    });
    statuses[def.name] = status;
  }

  console.log(`  Created ${statusDefinitions.length} workflow statuses`);

  // ------------------------------------------------------------------
  // 5. Create labels (workspace-scoped)
  // ------------------------------------------------------------------
  const labelDefinitions = [
    { name: 'Bug', color: '#EF4444' },
    { name: 'Feature', color: '#3B82F6' },
    { name: 'Enhancement', color: '#8B5CF6' },
    { name: 'Documentation', color: '#10B981' },
    { name: 'Performance', color: '#F59E0B' },
    { name: 'Security', color: '#DC2626' },
    { name: 'UX', color: '#EC4899' },
  ];

  const labels: Record<string, { id: string }> = {};

  for (const def of labelDefinitions) {
    const label = await prisma.label.upsert({
      where: {
        workspaceId_name: { workspaceId: workspace.id, name: def.name },
      },
      update: {},
      create: {
        ...def,
        workspaceId: workspace.id,
      },
    });
    labels[def.name] = label;
  }

  console.log(`  Created ${labelDefinitions.length} labels`);

  // ------------------------------------------------------------------
  // 6. Create sample issues
  // ------------------------------------------------------------------
  const issueDefinitions = [
    {
      title: 'Set up project scaffolding with Next.js 15',
      type: IssueType.TASK,
      priority: Priority.HIGH,
      status: 'Done',
      assignee: demoUser.id,
      labels: ['Feature'],
      description: 'Initialize the project with Next.js 15, TypeScript, Tailwind CSS, and configure the basic project structure.',
    },
    {
      title: 'Design database schema with Prisma',
      type: IssueType.TASK,
      priority: Priority.HIGH,
      status: 'Done',
      assignee: demoUser.id,
      labels: ['Feature'],
      description: 'Create the Prisma schema with all models needed for the MVP.',
    },
    {
      title: 'Implement user authentication with NextAuth.js',
      type: IssueType.STORY,
      priority: Priority.URGENT,
      status: 'In Progress',
      assignee: demoUser.id,
      labels: ['Feature', 'Security'],
      description: 'Set up NextAuth.js v5 with credentials and OAuth providers.',
    },
    {
      title: 'Build Kanban board view with drag-and-drop',
      type: IssueType.STORY,
      priority: Priority.HIGH,
      status: 'In Progress',
      assignee: secondUser.id,
      labels: ['Feature', 'UX'],
      description: 'Create the Kanban board with columns based on workflow statuses and drag-and-drop card reordering.',
    },
    {
      title: 'Create issue detail slide-over panel',
      type: IssueType.STORY,
      priority: Priority.MEDIUM,
      status: 'Todo',
      assignee: secondUser.id,
      labels: ['Feature'],
      description: 'Sheet component that slides in from the right with full issue details, comments, and activity.',
    },
    {
      title: 'Implement workspace settings page',
      type: IssueType.TASK,
      priority: Priority.MEDIUM,
      status: 'Todo',
      assignee: demoUser.id,
      labels: ['Feature'],
      description: 'Build workspace general settings and member management pages.',
    },
    {
      title: 'Add full-text search for issues',
      type: IssueType.STORY,
      priority: Priority.MEDIUM,
      status: 'Todo',
      assignee: null,
      labels: ['Feature', 'Performance'],
      description: 'Implement PostgreSQL full-text search on issue title and description text.',
    },
    {
      title: 'Fix sidebar not collapsing on mobile',
      type: IssueType.BUG,
      priority: Priority.HIGH,
      status: 'In Review',
      assignee: secondUser.id,
      labels: ['Bug', 'UX'],
      description: 'The sidebar stays open on mobile viewports and overlaps content.',
    },
    {
      title: 'Improve issue list view performance',
      type: IssueType.TASK,
      priority: Priority.MEDIUM,
      status: 'Backlog',
      assignee: null,
      labels: ['Performance'],
      description: 'Add server-side pagination and virtual scrolling for large issue lists.',
    },
    {
      title: 'Add dark mode support',
      type: IssueType.STORY,
      priority: Priority.LOW,
      status: 'Backlog',
      assignee: null,
      labels: ['Enhancement', 'UX'],
      description: 'Integrate next-themes for dark/light mode toggle.',
    },
    {
      title: 'Write API documentation',
      type: IssueType.TASK,
      priority: Priority.LOW,
      status: 'Backlog',
      assignee: null,
      labels: ['Documentation'],
      description: 'Document all server actions and API routes for developer onboarding.',
    },
    {
      title: 'Implement comment threading',
      type: IssueType.STORY,
      priority: Priority.MEDIUM,
      status: 'Backlog',
      assignee: null,
      labels: ['Feature'],
      description: 'Add the ability to reply to comments with a threaded conversation view.',
    },
    {
      title: 'Add keyboard shortcuts for common actions',
      type: IssueType.STORY,
      priority: Priority.LOW,
      status: 'Backlog',
      assignee: null,
      labels: ['Enhancement', 'UX'],
      description: 'Implement keyboard shortcuts (e.g., C for create, / for search) across the app.',
    },
    {
      title: 'Fix issue creation form not clearing after submit',
      type: IssueType.BUG,
      priority: Priority.MEDIUM,
      status: 'Todo',
      assignee: demoUser.id,
      labels: ['Bug'],
      description: 'After creating a new issue, the form fields retain previous values.',
    },
    {
      title: 'Set up CI/CD pipeline with GitHub Actions',
      type: IssueType.TASK,
      priority: Priority.HIGH,
      status: 'Backlog',
      assignee: null,
      labels: ['Enhancement'],
      description: 'Configure GitHub Actions for linting, type checking, testing, and deployment.',
    },
  ];

  // Use fractional indexing positions (simple string-based ordering)
  const positionBase = 'a';

  let issueNumber = project.issueCounter;

  for (let i = 0; i < issueDefinitions.length; i++) {
    const def = issueDefinitions[i];
    issueNumber++;

    const issueKey = `${project.prefix}-${issueNumber}`;

    // Check if issue already exists
    const existing = await prisma.issue.findUnique({ where: { key: issueKey } });
    if (existing) continue;

    const labelConnections = def.labels
      .filter((name) => labels[name])
      .map((name) => ({ id: labels[name].id }));

    await prisma.issue.create({
      data: {
        key: issueKey,
        number: issueNumber,
        title: def.title,
        descriptionText: def.description,
        description: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: def.description }],
            },
          ],
        },
        type: def.type,
        priority: def.priority,
        position: `${positionBase}${String(i).padStart(4, '0')}`,
        statusId: statuses[def.status].id,
        projectId: project.id,
        assigneeId: def.assignee,
        reporterId: demoUser.id,
        labels: {
          connect: labelConnections,
        },
      },
    });
  }

  // Update project issue counter
  await prisma.project.update({
    where: { id: project.id },
    data: { issueCounter: issueNumber },
  });

  console.log(`  Created ${issueDefinitions.length} issues (PM-1 through PM-${issueNumber})`);

  // ------------------------------------------------------------------
  // 7. Create sample activity entries
  // ------------------------------------------------------------------
  const allIssues = await prisma.issue.findMany({
    where: { projectId: project.id },
    take: 5,
    orderBy: { createdAt: 'asc' },
  });

  for (const issue of allIssues) {
    await prisma.activity.create({
      data: {
        type: 'ISSUE_CREATED',
        issueId: issue.id,
        projectId: project.id,
        actorId: demoUser.id,
        metadata: {
          issueKey: issue.key,
          title: issue.title,
        },
      },
    });
  }

  console.log(`  Created ${allIssues.length} activity log entries`);
  console.log('');
  console.log('Seed complete! Demo credentials:');
  console.log('  Email:    demo@pmapp.dev');
  console.log('  Password: password123');
  console.log('  Workspace: acme-corp');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
