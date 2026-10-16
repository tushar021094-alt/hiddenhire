"use client";

import RecruiterOutreachCard from "@/components/recruiter-outreach-card";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VerificationPanel from "./verification-panel";
type CreatedJob = {
  id: string;
  company_id: string | null;
  posted_by: string;
  title: string;
  description: string;
  city: string | null;
  region: string | null;
  country: string;
  remote: boolean;
  workplace_type: string;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  experience_min: number | null;
  experience_max: number | null;
  status: string;
  visibility: string;
  created_at: string;
};

type AiNormalized = {
  role: string;
  skills: string[];
};
type CandidateMatch = {
  candidateId: string;
  name: string | null;
  headline: string | null;
  score: number;
  opportunityScore: number;
  matchTier: string;
  roleClassification: string;
  reasons: string[];
  missingRequirements: string[];
  recruiterScore: number;
  readinessScore: number;
  recruiterPriority: "strong" | "promising" | "review";
  recruiterConfidence: "high" | "medium" | "low";
  nextAction: "shortlist" | "review" | "keep_watching";
};

export default function RecruiterPage(){
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.ge¶»§q«^