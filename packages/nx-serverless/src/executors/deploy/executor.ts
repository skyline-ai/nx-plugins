import type { ExecutorContext } from '@nrwl/devkit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { copyFile } from 'fs';
import { SlsExecutorOptions } from './sls-executor-options';

export default async function slsExecutor(
  options: SlsExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {

  let success = false;
  const { projectName } = context;
  const stage = options.stage;
  console.info(`Executing "sls" (${projectName})...`);

  if (!context.workspace.projects[projectName].targets.build.options?.generatePackageJson) {
    throw new Error('You must set targets.*.options.generatePackageJson in project.json to true');
  }

  try {
    console.info('Installing dependencies');
    const command = await promisify(exec)(`cd dist/apps/${projectName} && npm i`);
    if (command.stderr) {
      throw new Error(command.stderr);
    }

    console.info('Copying serverless.yml');
    await copyFile(
      `apps/${projectName}/serverless.yml`,
      `dist/apps/${projectName}/serverless.yml`,
      (err) => {
        if (err) throw new Error('Could not find serverless.yml in root directory')
      }
    );

    console.info(`Deploying "${projectName}" using Serverless (${stage ? 'stage: ' + stage : 'not specified'})`);
    let flags = '';
    if (stage) {
      flags += '--stage ' + stage;
    }
    const { stdout, stderr } = await promisify(exec)(`cd dist/apps/${projectName} && sls deploy ${flags}`);
    console.log(stdout);

    if (stderr) {
      if (stderr.includes('No changes to deploy')) {
        console.info(`No changes. Skipping deploy.`);
      } else {
        throw new Error(stderr);
      }
    }

    success = true;
  } catch (e) {
    console.error(e);
    success = false;
  }

  return { success };
}
