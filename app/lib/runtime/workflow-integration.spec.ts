import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import YAML from 'yaml';

describe('GitHub Actions Workflow Integration', () => {
  const workflowsDir = path.join(process.cwd(), '.github', 'workflows');

  it('should have all required workflow files', async () => {
    const requiredWorkflows = [
      'ci.yaml',
      'comprehensive-tests.yaml',
      'deploy.yaml',
      'documentation.yaml',
      'dependency-management.yaml',
      'status-badges.yaml',
      'semantic-pr.yaml'
    ];

    for (const workflow of requiredWorkflows) {
      const workflowPath = path.join(workflowsDir, workflow);
      const exists = await fs.access(workflowPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  it('should have valid YAML syntax in all workflows', async () => {
    const files = await fs.readdir(workflowsDir);
    const yamlFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));

    for (const file of yamlFiles) {
      const filePath = path.join(workflowsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      expect(() => {
        YAML.parse(content);
      }).not.toThrow();
    }
  });

  it('should have proper workflow triggers configured', async () => {
    const ciWorkflow = path.join(workflowsDir, 'ci.yaml');
    const content = await fs.readFile(ciWorkflow, 'utf-8');
    const workflow = YAML.parse(content);

    expect(workflow.on).toBeDefined();
    expect(workflow.on.push).toBeDefined();
    expect(workflow.on.pull_request).toBeDefined();
    expect(workflow.on.workflow_dispatch).toBeDefined();
  });

  it('should have environment variables configured in workflows', async () => {
    const ciWorkflow = path.join(workflowsDir, 'ci.yaml');
    const content = await fs.readFile(ciWorkflow, 'utf-8');
    const workflow = YAML.parse(content);

    expect(workflow.env).toBeDefined();
    expect(workflow.env.NODE_VERSION).toBeDefined();
    expect(workflow.env.PNPM_VERSION).toBeDefined();
  });

  it('should have timeout configurations for jobs', async () => {
    const ciWorkflow = path.join(workflowsDir, 'ci.yaml');
    const content = await fs.readFile(ciWorkflow, 'utf-8');
    const workflow = YAML.parse(content);

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const jobConfig = job as any;
      if (!jobConfig['timeout-minutes']) {
        console.log(`Job "${jobName}" missing timeout-minutes:`, job);
      }
      expect(jobConfig['timeout-minutes']).toBeDefined();
      expect(typeof jobConfig['timeout-minutes']).toBe('number');
      expect(jobConfig['timeout-minutes']).toBeGreaterThan(0);
    }
  });

  it('should use consistent action versions', async () => {
    const files = await fs.readdir(workflowsDir);
    const yamlFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
    
    const actionVersions = new Map();

    for (const file of yamlFiles) {
      const filePath = path.join(workflowsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const workflow = YAML.parse(content);

      if (workflow.jobs) {
        for (const job of Object.values(workflow.jobs)) {
          const jobConfig = job as any;
          if (jobConfig.steps) {
            for (const step of jobConfig.steps) {
              if (step.uses && step.uses.startsWith('actions/')) {
                const action = step.uses.split('@')[0];
                const version = step.uses.split('@')[1];
                
                if (actionVersions.has(action) && actionVersions.get(action) !== version) {
                  console.warn(`Inconsistent version for ${action}: ${actionVersions.get(action)} vs ${version}`);
                }
                actionVersions.set(action, version);
              }
            }
          }
        }
      }
    }

    // Check that checkout action uses v4
    expect(actionVersions.get('actions/checkout')).toBe('v4');
  });

  it('should have artifact upload/download configured properly', async () => {
    const deployWorkflow = path.join(workflowsDir, 'deploy.yaml');
    const content = await fs.readFile(deployWorkflow, 'utf-8');
    const workflow = YAML.parse(content);

    let hasUpload = false;
    let hasDownload = false;

    for (const job of Object.values(workflow.jobs)) {
      const jobConfig = job as any;
      if (jobConfig.steps) {
        for (const step of jobConfig.steps) {
          if (step.uses === 'actions/upload-artifact@v4') {
            hasUpload = true;
            expect(step.with.name).toBeDefined();
            expect(step.with.path).toBeDefined();
          }
          if (step.uses === 'actions/download-artifact@v4') {
            hasDownload = true;
            expect(step.with.name).toBeDefined();
          }
        }
      }
    }

    expect(hasUpload).toBe(true);
    expect(hasDownload).toBe(true);
  });
});

describe('Repository Functions Integration', () => {
  it('should have package.json scripts that workflows can use', async () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    const requiredScripts = [
      'build',
      'test',
      'typecheck',
      'lint'
    ];

    for (const script of requiredScripts) {
      expect(packageJson.scripts[script]).toBeDefined();
    }
  });

  it('should have build output directory structure', async () => {
    // Run build first
    const { execSync } = require('child_process');
    execSync('pnpm run build', { cwd: process.cwd() });

    const buildDir = path.join(process.cwd(), 'build');
    const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
    expect(buildExists).toBe(true);

    const clientDir = path.join(buildDir, 'client');
    const clientExists = await fs.access(clientDir).then(() => true).catch(() => false);
    expect(clientExists).toBe(true);

    const serverDir = path.join(buildDir, 'server');
    const serverExists = await fs.access(serverDir).then(() => true).catch(() => false);
    expect(serverExists).toBe(true);
  });

  it('should have proper TypeScript configuration', async () => {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    const exists = await fs.access(tsconfigPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    
    const content = await fs.readFile(tsconfigPath, 'utf-8');
    expect(content).toContain('compilerOptions');
    expect(content).toContain('moduleResolution');
    expect(content).toContain('target');
  });
});