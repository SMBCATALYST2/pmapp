#!/usr/bin/env bun
/**
 * provision_tenant.ts
 *
 * Creates an admin user + workspace for a new tenant.
 * Called by the SMBNext-Cloud control plane during provisioning.
 *
 * Usage:
 *   bun scripts/provision_tenant.ts \
 *     --admin-email admin@example.com \
 *     --admin-password SecureP@ss123 \
 *     --slug my-company \
 *     --name "My Company"
 */

import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function parseArgs(): {
  adminEmail: string;
  adminPassword: string;
  slug: string;
  name: string;
} {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    parsed[key] = args[i + 1];
  }

  if (!parsed.adminEmail || !parsed.adminPassword || !parsed.slug) {
    console.error("Usage: provision_tenant.ts --admin-email EMAIL --admin-password PASS --slug SLUG [--name NAME]");
    process.exit(1);
  }

  return {
    adminEmail: parsed.adminEmail,
    adminPassword: parsed.adminPassword,
    slug: parsed.slug,
    name: parsed.name || parsed.slug,
  };
}

async function main() {
  const { adminEmail, adminPassword, slug, name } = parseArgs();

  console.log(`Provisioning tenant: ${slug} (${adminEmail})`);

  // 1. Create or update admin user
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase().trim() },
    update: {
      password: hashedPassword,
      emailVerified: new Date(),
    },
    create: {
      name: adminEmail.split("@")[0],
      email: adminEmail.toLowerCase().trim(),
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  console.log(`  Admin user: ${user.email} (${user.id})`);

  // 2. Create workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug },
    update: { name },
    create: {
      name,
      slug,
      description: `${name} workspace`,
      ownerId: user.id,
    },
  });

  console.log(`  Workspace: ${workspace.name} (${workspace.slug})`);

  // 3. Add admin as OWNER member
  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId: workspace.id },
    },
    update: { role: "OWNER" },
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: "OWNER",
    },
  });

  console.log(`  Role: OWNER (full permissions)`);

  // 4. Create a default project so the workspace isn't empty
  const existingProject = await prisma.project.findFirst({
    where: { workspaceId: workspace.id },
  });

  if (!existingProject) {
    const project = await prisma.project.create({
      data: {
        name: "General",
        prefix: "GEN",
        description: "Default project",
        icon: "📋",
        color: "#3B82F6",
        workspaceId: workspace.id,
        leadId: user.id,
        issueCounter: 0,
      },
    });

    // Create default workflow statuses
    const statuses = [
      { name: "Backlog", category: "BACKLOG" as const, color: "#6B7280", position: 0 },
      { name: "Todo", category: "TODO" as const, color: "#3B82F6", position: 1 },
      { name: "In Progress", category: "IN_PROGRESS" as const, color: "#F59E0B", position: 2 },
      { name: "In Review", category: "IN_PROGRESS" as const, color: "#8B5CF6", position: 3 },
      { name: "Done", category: "DONE" as const, color: "#10B981", position: 4 },
      { name: "Cancelled", category: "CANCELLED" as const, color: "#EF4444", position: 5 },
    ];

    for (const s of statuses) {
      await prisma.workflowStatus.create({
        data: { ...s, projectId: project.id },
      });
    }

    console.log(`  Default project: ${project.name} (${project.prefix})`);
  }

  console.log("Provisioning complete!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Provisioning failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
