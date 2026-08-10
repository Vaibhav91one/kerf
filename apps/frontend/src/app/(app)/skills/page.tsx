import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SharedLibrary } from './shared-library';

export default async function SkillsPage() {
  const [{ skills }, { skills: library }] = await Promise.all([api.skills(), api.skillLibrary()]);

  return (
    <Tabs defaultValue="usage">
      <TabsList>
        <TabsTrigger value="usage">League Usage</TabsTrigger>
        <TabsTrigger value="library">Shared Library</TabsTrigger>
      </TabsList>
      <TabsContent value="usage">
        <Card>
          <CardHeader>
            <CardTitle>League-wide tool usage</CardTitle>
            <CardDescription>Names only, from profiles with public skills turned on. Off by default.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead className="text-right">Uses</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No public skill data yet.
                    </TableCell>
                  </TableRow>
                )}
                {skills.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-mono">{s.name}</TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                    <TableCell className="text-right">{s.users}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="library">
        <SharedLibrary initialSkills={library} />
      </TabsContent>
    </Tabs>
  );
}
