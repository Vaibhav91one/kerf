'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { LIMITS } from '@kerf/shared';
import { api, ApiError, type ProjectJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function NewProjectForm({ onCreated }: { onCreated: (p: ProjectJson) => void }) {
  const { auth } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!auth) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!auth) return;
    setError(null);
    setBusy(true);
    try {
      const project = await api.createProject(auth.token, {
        name,
        description: description || undefined,
        repoUrl: repoUrl || undefined,
      });
      onCreated(project);
      setName('');
      setDescription('');
      setRepoUrl('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish project');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Publish a project</CardTitle>
        <CardDescription>
          Name up to {LIMITS.projectName} chars, description up to {LIMITS.projectDescription}, repo URL must be http(s).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.projectName} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={LIMITS.projectDescription}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="repoUrl">Repo URL</Label>
            <Input
              id="repoUrl"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              maxLength={LIMITS.repoUrl}
              placeholder="https://github.com/..."
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Publishing…' : 'Publish'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ProjectsPage() {
  const { auth } = useAuth();
  const [projects, setProjects] = useState<ProjectJson[] | null>(null);

  useEffect(() => {
    api.projects().then((r) => setProjects(r.projects));
  }, []);

  return (
    <div className="space-y-6">
      {auth && projects && <NewProjectForm onCreated={(p) => setProjects([p, ...projects])} />}

      <Card>
        <CardHeader>
          <CardTitle>Build in public</CardTitle>
          <CardDescription>Projects people have chosen to publish.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {projects === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {projects?.length === 0 && <p className="text-sm text-muted-foreground">No projects published yet.</p>}
          {projects?.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <CardDescription>
                  <Link href={`/people/${p.handle}`} className="hover:underline">
                    @{p.handle}
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                {p.repoUrl && (
                  <Link href={p.repoUrl} className="text-sm text-primary hover:underline" target="_blank" rel="noreferrer">
                    {p.repoUrl}
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
