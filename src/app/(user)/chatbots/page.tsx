"use client"
import Image from "next/image"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Bookmark, RotateCcw, Plus, MoreVertical, MessageSquareText, Bot, BookA, Trash } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { useWorkspace } from "@/providers/workspace-provider"

// Form validation schema
const formSchema = z.object({
  name: z
    .string()
    .min(1, "Chatbot name is required")
    .max(50, "Name must be less than 50 characters")
    .trim(),
})

type FormValues = z.infer<typeof formSchema>

interface Chatbot {
  id: string
  serialNo: number
  name: string
  icon: string
  greeting: string
  description?: string | null
  instructions?: string | null
  model: string
  temperature: number
  max_tokens: number
  createdAt: string
  updatedAt: string
  _count?: {
    conversations: number
    knowledgeBases: number
  }
}

export default function ChatbotsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const [itemsPerPage, setItemsPerPage] = useState("25")
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [chatbotToDelete, setChatbotToDelete] = useState<Chatbot | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [chatbotToDuplicate, setChatbotToDuplicate] = useState<Chatbot | null>(null)

  const { activeWorkspace } = useWorkspace();

  // Initialize form with React Hook Form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
    mode: "onChange",
  })

  const {
    handleSubmit,
    formState: { isSubmitting, isValid },
    reset,
  } = form

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchChatbots()
    }
  }, [activeWorkspace?.id])

  const fetchChatbots = async () => {
    if (!activeWorkspace?.id) return;

    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(`/api/chatbots?workspaceId=${activeWorkspace?.id}`)

      if (!response.ok) {
        throw new Error('Failed to fetch chatbots')
      }

      const data = await response.json()
      setChatbots(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Error fetching chatbots:', err)

      toast.error("Failed to load chatbots")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (chatbot: Chatbot) => {
    setChatbotToDelete(chatbot)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!chatbotToDelete) return

    try {
      const response = await fetch(`/api/chatbots/${chatbotToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete chatbot')
      }

      setChatbots(chatbots.filter(chatbot => chatbot.id !== chatbotToDelete.id))

      toast.success(`${chatbotToDelete.name} has been deleted successfully.`);
    } catch (err) {
      toast.error("Failed to delete chatbot");
      console.error('Error deleting chatbot:', err)
    } finally {
      setDeleteDialogOpen(false)
      setChatbotToDelete(null)
    }
  }

  const handleDuplicate = async (chatbot: Chatbot) => {
    setChatbotToDuplicate(chatbot)
    setDuplicateDialogOpen(true)
  }

  const confirmDuplicate = async () => {
    if (!chatbotToDuplicate) return

    try {
      const response = await fetch('/api/chatbots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${chatbotToDuplicate.name} (Copy)`,
          workspaceId: activeWorkspace?.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to duplicate chatbot')
      }

      const data = await response.json()
      fetchChatbots()

      toast.success("Chatbot duplicated")

      return data
    } catch (err) {
      toast.error("Failed to duplicate chatbot")
      console.error('Error duplicating chatbot:', err)
    } finally {
      setDuplicateDialogOpen(false)
      setChatbotToDuplicate(null)
    }
  }

  const handleEdit = (id: string) => {
    router.push(`/chatbots/${id}/edit`)
  }

  const onSubmit = async (data: FormValues) => {
    try {
      const response = await fetch('/api/chatbots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          workspaceId: activeWorkspace?.id,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create chatbot')
      }

      // Close dialog, reset form, and refresh list
      setIsCreateDialogOpen(false)
      reset()
      fetchChatbots()

      toast.success("Chatbot created");

      // Redirect to the newly created chatbot's edit page
      router.push(`/chatbots/${responseData.chatbot.id}/instructions`)

    } catch (error) {
      console.error('Error creating chatbot:', error)
      toast.error("Failed to create chatbot")
    }
  }

  const filteredChatbots = chatbots.filter((chatbot) =>
    chatbot.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const totalItems = filteredChatbots.length
  const startItem = 1
  const endItem = Math.min(Number.parseInt(itemsPerPage), totalItems)

  const getModelDisplayName = (model: string) => {
    const modelMap: Record<string, string> = {
      'gpt-4': 'GPT-4',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4-mini': 'GPT-4 Mini',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'claude-3': 'Claude 3',
      'claude-2': 'Claude 2',
      'gemini-pro': 'Gemini Pro',
      'llama-2': 'Llama 2',
    }

    return modelMap[model] || model
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 7 }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-6 w-24" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-full bg-destructive/10 p-3">
          <div className="text-2xl">⚠️</div>
        </div>
        <div>
          <h3 className="text-lg font-semibold">Failed to load chatbots</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
        <Button onClick={fetchChatbots} variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the chatbot{" "}
              <span className="font-semibold">{chatbotToDelete?.name}</span> and all of its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChatbotToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Confirmation Dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Chatbot</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a copy of{" "}
              <span className="font-semibold">{chatbotToDuplicate?.name}</span>.
              The duplicate will have "(Copy)" appended to its name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChatbotToDuplicate(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDuplicate}>
              Duplicate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Chatbots</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 cursor-pointer">
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Chatbot</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Chatbot Name
                        <span className="text-destructive ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Customer Support Bot"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <div className="flex justify-between items-center">
                        <FormMessage />
                        <span className={`text-xs ${field.value.length > 50 ? 'text-destructive' : 'text-muted-foreground'
                          }`}>
                          {field.value.length}/50
                        </span>
                      </div>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !isValid}
                  >
                    {isSubmitting ? 'Creating...' : 'Create Chatbot'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All chatbots</SelectItem>
            <SelectItem value="recent">Recently modified</SelectItem>
            <SelectItem value="gpt">GPT models</SelectItem>
            <SelectItem value="other">Other models</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" title="Bookmark view">
          <Bookmark className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Refresh"
          onClick={fetchChatbots}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">S.NO.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Conversations</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Knowledge Bases</TableHead>
              <TableHead>Last modified</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredChatbots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="rounded-full bg-muted p-3">
                      <div className="text-2xl">🤖</div>
                    </div>
                    <div>
                      <p className="font-medium">No chatbots found</p>
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? 'Try a different search term' : 'Create your first chatbot'}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredChatbots.slice(0, Number.parseInt(itemsPerPage)).map((chatbot, index) => (
                <TableRow key={chatbot.id}>
                  <TableCell className="text-center font-medium">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Image className="h-6 w-6 rounded-full" height={16} width={16} src={chatbot.icon || '/icons/logo1.png'} alt="" />
                      <div className="flex flex-col">
                        <Link href={`/chatbots/${chatbot.id}/instructions`} className="font-medium hover:underline">
                          {chatbot.name}
                        </Link>
                        {chatbot.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-50">
                            {chatbot.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4" />
                      <span>{chatbot._count?.conversations || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="flex items-center justify-center gap-2">
                    <Bot className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{getModelDisplayName(chatbot.model)}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>Temp: {chatbot.temperature}</span>
                        <span>•</span>
                        <span>Tokens: {chatbot.max_tokens}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm flex justify-center gap-2 items-center">
                      <BookA className="h-4 w-4" />
                      {chatbot._count?.knowledgeBases || 0} KB{chatbot._count?.knowledgeBases !== 1 ? 's' : ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">
                        {formatDistanceToNow(new Date(chatbot.updatedAt), { addSuffix: true })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Created {formatDistanceToNow(new Date(chatbot.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      onClick={() => handleDelete(chatbot)}
                    >
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {filteredChatbots.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {startItem}–{endItem} of {totalItems} chatbot{totalItems !== 1 ? 's' : ''}
          </span>
          <Select value={itemsPerPage} onValueChange={setItemsPerPage}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}