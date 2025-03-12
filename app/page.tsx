"use client";

import { useState, useEffect } from "react";
import { Upload, PackageSearch, FileJson, GitGraph, TableIcon, NetworkIcon, Calendar, Tag, RefreshCw, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import axios from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TreeGraph } from "@/components/tree-graph";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import semver from "semver";

interface Dependency {
  name: string;
  version: string;
  type: "dependency" | "devDependency";
  dependencies?: { [key: string]: string };
  latestVersion?: string;
  lastPublished?: string;
  loading?: boolean;
}

interface ProcessedDependency extends Dependency {
  children?: ProcessedDependency[];
}

export default function Home() {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [nestedDependencies, setNestedDependencies] = useState<ProcessedDependency[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "graph">("table");
  const [fetchAllLoading, setFetchAllLoading] = useState<boolean>(false);

  const fetchPackageInfo = async (packageName: string): Promise<{ version: string; time: { modified: string } }> => {
    try {
      const response = await axios.get(`https://registry.npmjs.org/${packageName}`);
      return {
        version: response.data['dist-tags'].latest,
        time: {
          modified: response.data.time.modified
        }
      };
    } catch (error) {
      console.error(`Error fetching info for ${packageName}:`, error);
      return { version: 'N/A', time: { modified: 'N/A' } };
    }
  };

  const fetchSinglePackageInfo = async (dep: Dependency, index: number) => {
    setDependencies(prev => prev.map((d, i) => 
      i === index ? { ...d, loading: true } : d
    ));

    try {
      const info = await fetchPackageInfo(dep.name);
      setDependencies(prev => prev.map((d, i) => 
        i === index ? {
          ...d,
          latestVersion: info.version,
          lastPublished: info.time.modified,
          loading: false
        } : d
      ));
    } catch (error) {
      setDependencies(prev => prev.map((d, i) => 
        i === index ? { ...d, loading: false } : d
      ));
    }
  };

  const fetchAllPackagesInfo = async () => {
    setFetchAllLoading(true);
    
    try {
      const updatedDeps = await Promise.all(
        dependencies.map(async (dep) => {
          const info = await fetchPackageInfo(dep.name);
          return {
            ...dep,
            latestVersion: info.version,
            lastPublished: info.time.modified,
          };
        })
      );
      setDependencies(updatedDeps);
    } catch (error) {
      console.error("Error fetching all packages:", error);
    }
    
    setFetchAllLoading(false);
  };

  const processNestedDependencies = (packageLock: any): ProcessedDependency[] => {
    const processNode = (name: string, info: any, type: "dependency" | "devDependency"): ProcessedDependency => {
      const children = info.dependencies
        ? Object.entries(info.dependencies).map(([depName, depInfo]: [string, any]) =>
            processNode(depName, depInfo, type)
          )
        : [];

      return {
        name,
        version: info.version || "",
        type,
        children: children.length > 0 ? children : undefined,
      };
    };

    const result: ProcessedDependency[] = [];

    if (packageLock.dependencies) {
      Object.entries(packageLock.dependencies).forEach(([name, info]: [string, any]) => {
        if (packageLock.packages?.[""]?.dependencies?.[name]) {
          result.push(processNode(name, info, "dependency"));
        }
      });
    }

    if (packageLock.packages?.[""]?.devDependencies) {
      Object.entries(packageLock.packages[""].devDependencies).forEach(([name]) => {
        if (packageLock.dependencies?.[name]) {
          result.push(processNode(name, packageLock.dependencies[name], "devDependency"));
        }
      });
    }

    return result;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        const deps: Dependency[] = [];
        const isPackageLock = file.name === "package-lock.json";

        if (isPackageLock) {
          const nested = processNestedDependencies(content);
          setNestedDependencies(nested);
          
          const flattenDeps = (dep: ProcessedDependency) => {
            deps.push({
              name: dep.name,
              version: dep.version,
              type: dep.type,
            });
            dep.children?.forEach(flattenDeps);
          };
          nested.forEach(flattenDeps);
        } else {
          if (content.dependencies) {
            Object.entries(content.dependencies).forEach(([name, version]) => {
              deps.push({
                name,
                version: version as string,
                type: "dependency",
              });
            });
          }

          if (content.devDependencies) {
            Object.entries(content.devDependencies).forEach(([name, version]) => {
              deps.push({
                name,
                version: version as string,
                type: "devDependency",
              });
            });
          }
        }

        setDependencies(deps);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    };

    reader.readAsText(file);
  };

  const getDependencyStats = () => {
    const total = dependencies.length;
    const prodDeps = dependencies.filter((d) => d.type === "dependency").length;
    const devDeps = dependencies.filter((d) => d.type === "devDependency").length;
    return { total, prodDeps, devDeps };
  };

  const stats = getDependencyStats();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            Package Analyzer
          </h1>
          <p className="text-muted-foreground">
            Upload your package.json or package-lock.json to analyze dependencies
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 flex flex-col items-center justify-center space-y-2">
            <PackageSearch className="h-8 w-8 text-primary mb-2" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Packages</div>
          </Card>
          <Card className="p-6 flex flex-col items-center justify-center space-y-2">
            <FileJson className="h-8 w-8 text-primary mb-2" />
            <div className="text-2xl font-bold">{stats.prodDeps}</div>
            <div className="text-sm text-muted-foreground">Dependencies</div>
          </Card>
          <Card className="p-6 flex flex-col items-center justify-center space-y-2">
            <Upload className="h-8 w-8 text-primary mb-2" />
            <div className="text-2xl font-bold">{stats.devDeps}</div>
            <div className="text-sm text-muted-foreground">Dev Dependencies</div>
          </Card>
          <Card className="p-6 flex flex-col items-center justify-center space-y-2">
            <GitGraph className="h-8 w-8 text-primary mb-2" />
            <div className="text-2xl font-bold">
              {nestedDependencies.reduce((acc, dep) => {
                const countChildren = (d: ProcessedDependency): number => {
                  return 1 + (d.children?.reduce((sum, child) => sum + countChildren(child), 0) || 0);
                };
                return acc + countChildren(dep);
              }, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Nested Dependencies</div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/50"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="h-8 w-8 text-primary mb-2" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag
                  and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  package.json or package-lock.json
                </p>
              </div>
              <Input
                id="file-upload"
                type="file"
                className="hidden"
                accept=".json"
                onChange={handleFileUpload}
              />
            </label>
          </div>
          {fileName && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Uploaded: {fileName}
            </p>
          )}
        </Card>

        {dependencies.length > 0 && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAllPackagesInfo}
                disabled={fetchAllLoading}
              >
                {fetchAllLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Fetch All Package Info
              </Button>

              <div className="flex space-x-2">
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                >
                  <TableIcon className="h-4 w-4 mr-2" />
                  Table View
                </Button>
                <Button
                  variant={viewMode === "graph" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("graph")}
                >
                  <NetworkIcon className="h-4 w-4 mr-2" />
                  Graph View
                </Button>
              </div>
            </div>

            {viewMode === "table" ? (
              <Card className="p-6">
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
                    <TabsTrigger value="devDependencies">Dev Dependencies</TabsTrigger>
                  </TabsList>
                  <TabsContent value="all">
                    <DependencyTable 
                      dependencies={dependencies}
                      onFetchInfo={fetchSinglePackageInfo}
                    />
                  </TabsContent>
                  <TabsContent value="dependencies">
                    <DependencyTable
                      dependencies={dependencies.filter(
                        (d) => d.type === "dependency"
                      )}
                      onFetchInfo={fetchSinglePackageInfo}
                    />
                  </TabsContent>
                  <TabsContent value="devDependencies">
                    <DependencyTable
                      dependencies={dependencies.filter(
                        (d) => d.type === "devDependency"
                      )}
                      onFetchInfo={fetchSinglePackageInfo}
                    />
                  </TabsContent>
                </Tabs>
              </Card>
            ) : (
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-6">Dependency Graph</h2>
                <div className="w-full h-[600px]">
                  <TreeGraph data={nestedDependencies} />
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DependencyTable({ 
  dependencies,
  onFetchInfo
}: { 
  dependencies: Dependency[];
  onFetchInfo: (dep: Dependency, index: number) => void;
}) {
  const isOutdated = (current: string, latest: string): boolean => {
    if (!latest || latest === 'N/A') return false;
    
    // Remove any leading characters (e.g., ^, ~, >=)
    const cleanCurrent = current.replace(/^[^0-9]*/, '');
    
    try {
      return semver.lt(cleanCurrent, latest);
    } catch {
      return false;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Package Name</TableHead>
            <TableHead>Current Version</TableHead>
            <TableHead>Latest Version</TableHead>
            <TableHead>Last Published</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dependencies.map((dep, index) => {
            const outdated = isOutdated(dep.version, dep.latestVersion);
            
            return (
              <TableRow key={`${dep.name}-${dep.type}`}>
                <TableCell className="font-medium">{dep.name}</TableCell>
                <TableCell>
                  <div className={cn(
                    "flex items-center gap-1",
                    outdated && "text-destructive font-medium"
                  )}>
                    <Tag className="h-4 w-4" />
                    {dep.version}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Tag className="h-4 w-4" />
                    {dep.latestVersion || 'N/A'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {dep.lastPublished ? format(new Date(dep.lastPublished), 'MMM d, yyyy') : 'N/A'}
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      dep.type === "dependency"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {dep.type}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFetchInfo(dep, index)}
                    disabled={dep.loading}
                  >
                    {dep.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}