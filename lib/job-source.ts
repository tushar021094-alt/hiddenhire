import type { Job } from './job-types';
import { seedJobs } from './job-data';

export interface JobSource {
  getJobs(): Promise<Job[]>;
}

export class SeedJobSource implements JobSource {
  async getJobs(): Promise<Job[]> {
    return Promise.resolve(seedJobs);
  }
}
