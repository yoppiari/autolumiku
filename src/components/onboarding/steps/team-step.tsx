/**
 * Team Setup Step
 * Allows inviting team members with role assignments
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Mail, Trash2, Users } from 'lucide-react';

interface TeamStepProps {
  onNext: (data: TeamData) => void;
  onBack: () => void;
  onSkip: () => void;
  initialData?: Partial<TeamData>;
}

export interface TeamMember {
  email: string;
  role: 'showroom_staff' | 'sales_person' | 'showroom_owner';
  name?: string;
}

export interface TeamData {
  members: TeamMember[];
}

export function TeamStep({ onNext, onBack, onSkip, initialData }: TeamStepProps) {
  const [members, setMembers] = useState<TeamMember[]>(initialData?.members || []);
  const [newMember, setNewMember] = useState<TeamMember>({
    email: '',
    role: 'showroom_staff',
    name: ''
  });

  const handleAddMember = () => {
    if (newMember.email) {
      setMembers([...members, newMember]);
      setNewMember({ email: '', role: 'showroom_staff', name: '' });
    }
  };

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({ members });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Undang Tim Anda</h2>
        <p className="text-gray-600 mt-2">
          Tambahkan anggota tim dan atur peran mereka
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Add Member Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Tambah Anggota Tim
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                placeholder="Nama lengkap"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="role">Peran</Label>
              <Select
                value={newMember.role}
                onValueChange={(value: any) => setNewMember({ ...newMember, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="showroom_owner">Pemilik Showroom</SelectItem>
                  <SelectItem value="showroom_staff">Staff Showroom</SelectItem>
                  <SelectItem value="sales_person">Sales Person</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="button" onClick={handleAddMember} className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Tambah ke Daftar
            </Button>
          </CardContent>
        </Card>

        {/* Team Members List */}
        {members.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Tim Anda ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {members.map((member, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{member.email}</span>
                      </div>
                      {member.name && (
                        <p className="text-sm text-gray-600 ml-6">{member.name}</p>
                      )}
                      <p className="text-sm text-gray-500 ml-6">
                        {member.role === 'showroom_owner' ? 'Pemilik Showroom' :
                         member.role === 'showroom_staff' ? 'Staff Showroom' : 'Sales Person'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            Kembali
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onSkip}>
              Lewati
            </Button>
            <Button type="submit">
              {members.length > 0 ? 'Kirim Undangan & Lanjutkan' : 'Lanjutkan'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
