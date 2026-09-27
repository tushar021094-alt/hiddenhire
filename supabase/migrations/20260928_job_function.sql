alter table public.jobs
  add column if not exists job_function text;

alter table public.jobs
  drop constraint if exists jobs_job_function_check;

alter table public.jobs
  add constraint jobs_job_function_check
  check (
    job_function is null
    or job_function in (
      'Finance',
      'Accounting',
      'FP&A',
      'Audit',
      'Tax',
      'Treasury',
      'Risk',
      'Operations',
      'Engineering',
      'Software',
      'Data',
      'Product',
      'Marketing',
      'Sales',
      'HR',
      'Legal',
      'Customer Success',
      'Design',
      'Other'
    )
  );

create index if not exists jobs_job_function_idx
  on public.jobs(job_function);