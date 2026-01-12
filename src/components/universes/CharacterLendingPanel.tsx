import { useState } from 'react';
import { Check, X, Clock, UserPlus, Shield, Globe, Lock, Users, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCharacterLending } from '@/hooks/useCharacterLending';
import type { LendingPermission } from '@/types/universe';
import { formatDistanceToNow } from 'date-fns';

const PERMISSION_CONFIG: Record<LendingPermission, { icon: React.ElementType; label: string; description: string }> = {
  none: { icon: Lock, label: 'Private', description: 'Only you can use this character' },
  universe_only: { icon: Users, label: 'Universe Only', description: 'Members of shared universes can borrow' },
  specific_users: { icon: UserPlus, label: 'By Request', description: 'Users can request to borrow' },
  public: { icon: Globe, label: 'Public', description: 'Anyone can use with credit' },
};

export function CharacterLendingPanel() {
  const {
    lendableCharacters,
    myLendableCharacters,
    incomingRequests,
    outgoingRequests,
    isLoading,
    requestLoan,
    respondToLoan,
    updateLendingSettings,
  } = useCharacterLending();

  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [borrowNotes, setBorrowNotes] = useState('');

  const handleBorrowRequest = async (characterId: string, ownerId: string) => {
    await requestLoan.mutateAsync({
      characterId,
      ownerId,
      notes: borrowNotes,
    });
    setBorrowNotes('');
    setSelectedCharacter(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="browse" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="browse">Browse</TabsTrigger>
        <TabsTrigger value="requests" className="relative">
          Requests
          {incomingRequests && incomingRequests.length > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
              {incomingRequests.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="borrowed">Borrowed</TabsTrigger>
        <TabsTrigger value="my-characters">My Characters</TabsTrigger>
      </TabsList>

      {/* Browse lendable characters */}
      <TabsContent value="browse" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lendableCharacters?.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="py-8 text-center text-muted-foreground">
                No characters available to borrow yet.
              </CardContent>
            </Card>
          )}

          {lendableCharacters?.map((character) => {
            const permConfig = PERMISSION_CONFIG[character.lending_permission];
            const PermIcon = permConfig.icon;

            return (
              <Card key={character.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={character.owner?.avatar_url || undefined} />
                      <AvatarFallback>{character.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{character.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        by {character.owner?.display_name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {character.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {character.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <PermIcon className="h-4 w-4" />
                      <span>{permConfig.label}</span>
                      {character.lending_credits_required > 0 && (
                        <Badge variant="outline" className="ml-2">
                          <Coins className="h-3 w-3 mr-1" />
                          {character.lending_credits_required}
                        </Badge>
                      )}
                    </div>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <UserPlus className="h-4 w-4 mr-1" />
                          Borrow
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Request to borrow {character.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>What will you use this character for?</Label>
                            <Textarea
                              placeholder="Describe your project and how you'll use this character..."
                              value={borrowNotes}
                              onChange={(e) => setBorrowNotes(e.target.value)}
                              rows={3}
                            />
                          </div>
                          <Button
                            className="w-full"
                            onClick={() => handleBorrowRequest(character.id, character.user_id)}
                            disabled={requestLoan.isPending}
                          >
                            Send Request
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      {/* Incoming requests */}
      <TabsContent value="requests" className="space-y-4">
        {incomingRequests?.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No pending requests
            </CardContent>
          </Card>
        )}

        {incomingRequests?.map((request) => (
          <Card key={request.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={request.borrower?.avatar_url || undefined} />
                    <AvatarFallback>
                      {request.borrower?.display_name?.slice(0, 2) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {request.borrower?.display_name || 'Unknown'} wants to borrow{' '}
                      <span className="text-primary">{request.character?.name}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                    </p>
                    {request.usage_notes && (
                      <p className="text-sm mt-1">{request.usage_notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => respondToLoan.mutate({ loanId: request.id, approved: false })}
                    disabled={respondToLoan.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => respondToLoan.mutate({ loanId: request.id, approved: true })}
                    disabled={respondToLoan.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      {/* My borrowed characters */}
      <TabsContent value="borrowed" className="space-y-4">
        {outgoingRequests?.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              You haven't borrowed any characters yet.
            </CardContent>
          </Card>
        )}

        {outgoingRequests?.map((request) => (
          <Card key={request.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{request.character?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Requested {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                  </p>
                </div>
                <Badge
                  variant={
                    request.status === 'approved' ? 'default' :
                    request.status === 'pending' ? 'secondary' :
                    'destructive'
                  }
                >
                  {request.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                  {request.status === 'approved' && <Check className="h-3 w-3 mr-1" />}
                  {request.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      {/* My characters lending settings */}
      <TabsContent value="my-characters" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Character Lending Settings</CardTitle>
            <CardDescription>
              Control who can borrow your characters for their videos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {myLendableCharacters?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Create characters to enable lending settings.
              </p>
            )}

            {myLendableCharacters?.map((character) => (
              <div key={character.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{character.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Borrowed {character.times_borrowed} times
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={character.lending_permission}
                    onValueChange={(v) => 
                      updateLendingSettings.mutate({ 
                        characterId: character.id, 
                        permission: v as LendingPermission 
                      })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PERMISSION_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className="h-4 w-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
