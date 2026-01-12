import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, Loader2, Upload, Video, DollarSign, 
  User, Phone, Mail, FileText, Link as LinkIcon, Camera
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { VideoRecorder } from "@/components/VideoRecorder";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const PRODUCTS = [
  { id: 'krs_assessment', name: 'KRS Assessment', price: 37, priceId: 'price_1Sni9jA7XlInXgw8nyCx0srR' },
  { id: 'membership', name: 'Catching Barrels Membership', price: 99, priceId: 'price_1SoacUA7XlInXgw8erLx2iRH' },
  { id: 'in_person_assessment', name: 'In-Person Assessment (Seasonal)', price: 299, priceId: 'price_1SnqwfA7XlInXgw809dC018v' },
];

const PAYMENT_OPTIONS = [
  { id: 'send_link', name: 'Send Payment Link', description: 'SMS payment link to their phone' },
  { id: 'already_paid', name: 'Already Paid', description: 'Cash, Venmo, or other' },
  { id: 'charge_later', name: 'Charge Later', description: 'Create unpaid session' },
];

const PAYMENT_METHODS = ['cash', 'venmo', 'cashapp', 'zelle', 'other'];

export default function AdminNewSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const playerId = searchParams.get('player');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [productType, setProductType] = useState('in_person_assessment');
  const [customAmount, setCustomAmount] = useState('');
  const [paymentOption, setPaymentOption] = useState('send_link');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [onformUrl, setOnformUrl] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  
  // Loading states
  const [creating, setCreating] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const selectedProduct = PRODUCTS.find(p => p.id === productType);
  const isCustomPrice = productType === 'custom';
  const finalPrice = isCustomPrice ? parseInt(customAmount) || 0 : (selectedProduct?.price || 0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        toast.error('Please select a video file');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast.error('Video must be under 100MB');
        return;
      }
      setVideoFile(file);
      toast.success(`Video selected: ${file.name}`);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleCreate = async () => {
    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    setCreating(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      // Determine initial status
      let status = 'pending_upload';
      if (paymentOption === 'already_paid') {
        status = videoFile ? 'paid' : 'paid';
      } else if (paymentOption === 'charge_later') {
        status = 'pending_payment';
      } else {
        status = 'pending_payment';
      }

      // Create session via edge function
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-in-person-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.replace(/\D/g, ''),
          product_type: isCustomPrice ? 'custom' : productType,
          price_cents: finalPrice * 100,
          payment_option: paymentOption,
          payment_method: paymentOption === 'already_paid' ? paymentMethod : null,
          player_notes: notes.trim() || null,
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create session');
      }

      const { session_id, payment_link_url } = await res.json();

      // Upload video if selected
      if (videoFile) {
        setUploadingVideo(true);
        toast.info('Uploading video...');

        const formData = new FormData();
        formData.append('file', videoFile);
        formData.append('sessionId', session_id);
        formData.append('swingIndex', '0');

        const uploadRes = await fetch(`${SUPABASE_URL}/functions/v1/upload-swing`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authSession?.access_token}`,
          },
          body: formData
        });

        if (!uploadRes.ok) {
          toast.error('Video upload failed, but session was created');
        } else {
          toast.success('Video uploaded!');
        }
        setUploadingVideo(false);
      }

      // Show success and navigate
      if (payment_link_url) {
        toast.success('Session created! Payment link sent via SMS.');
      } else if (paymentOption === 'already_paid') {
        toast.success('Session created as paid!');
      } else {
        toast.success('Session created!');
      }

      navigate(`/admin/analyzer`);

    } catch (error) {
      console.error('Create error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create session');
    } finally {
      setCreating(false);
      setUploadingVideo(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      
      <main className="container py-6 max-w-3xl">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin/analyzer')}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">New Assessment Session</h1>
            <p className="text-slate-400">Create a session for an in-person player</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Player Information */}
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <User className="h-5 w-5" />
                Player Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-slate-300">First Name *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-slate-300">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-300">Phone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="(555) 123-4567"
                      className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@email.com"
                      className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-slate-300">Notes (age, team, position, etc.)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="14yo, travel ball, 3B/OF..."
                  rows={2}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Product & Payment */}
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <DollarSign className="h-5 w-5" />
                Product & Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-slate-300">Product Type</Label>
                <RadioGroup value={productType} onValueChange={setProductType}>
                  {PRODUCTS.map((product) => (
                    <div key={product.id} className="flex items-center space-x-3 p-3 rounded-lg border border-slate-700 hover:bg-slate-800/50 cursor-pointer">
                      <RadioGroupItem value={product.id} id={product.id} className="border-slate-600" />
                      <Label htmlFor={product.id} className="flex-1 cursor-pointer text-white">
                        <span className="font-medium">{product.name}</span>
                        <span className="ml-2 text-red-400 font-bold">${product.price}</span>
                      </Label>
                    </div>
                  ))}
                  <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-700 hover:bg-slate-800/50 cursor-pointer">
                    <RadioGroupItem value="custom" id="custom" className="border-slate-600" />
                    <Label htmlFor="custom" className="cursor-pointer text-white">Custom Amount</Label>
                    {isCustomPrice && (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">$</span>
                        <Input
                          type="number"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="0"
                          className="w-24 bg-slate-800/50 border-slate-700 text-white"
                        />
                      </div>
                    )}
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label className="text-slate-300">Payment Status</Label>
                <RadioGroup value={paymentOption} onValueChange={setPaymentOption}>
                  {PAYMENT_OPTIONS.map((option) => (
                    <div key={option.id} className="flex items-center space-x-3 p-3 rounded-lg border border-slate-700 hover:bg-slate-800/50 cursor-pointer">
                      <RadioGroupItem value={option.id} id={option.id} className="border-slate-600" />
                      <Label htmlFor={option.id} className="flex-1 cursor-pointer text-white">
                        <span className="font-medium">{option.name}</span>
                        <span className="ml-2 text-slate-400 text-sm">— {option.description}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {paymentOption === 'already_paid' && (
                <div className="space-y-3 pl-6 border-l-2 border-red-500/20">
                  <Label className="text-slate-300">Payment Method Used</Label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHODS.map((method) => (
                      <Button
                        key={method}
                        variant={paymentMethod === method ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentMethod(method)}
                        className={`capitalize ${
                          paymentMethod === method 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {method}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Video Upload */}
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Video className="h-5 w-5" />
                Video Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {/* Record or Upload buttons */}
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowRecorder(true)}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Record Video
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Upload File
                </Button>
              </div>
              
              {/* Show selected video */}
              {videoFile && (
                <div className="border border-slate-700 rounded-lg p-4 text-center bg-slate-800/50">
                  <Video className="h-8 w-8 mx-auto text-red-400 mb-2" />
                  <p className="font-medium text-white">{videoFile.name}</p>
                  <p className="text-sm text-slate-400">
                    {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2 text-slate-400 hover:text-white hover:bg-slate-700"
                    onClick={() => setVideoFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-xs text-slate-500">or</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="onform" className="flex items-center gap-2 text-slate-300">
                  <LinkIcon className="h-4 w-4" />
                  OnForm Link (optional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="onform"
                    value={onformUrl}
                    onChange={(e) => setOnformUrl(e.target.value)}
                    placeholder="https://web.onform.com/..."
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <Button 
                    variant="outline" 
                    disabled={!onformUrl}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Import
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Create Button */}
          <Button 
            size="lg" 
            className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600" 
            onClick={handleCreate}
            disabled={creating || uploadingVideo}
          >
            {creating || uploadingVideo ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {uploadingVideo ? 'Uploading Video...' : 'Creating Session...'}
              </>
            ) : (
              <>
                <FileText className="h-5 w-5 mr-2" />
                Create Session & Go to Analyzer
              </>
            )}
          </Button>
        </div>

        {/* Video Recorder Dialog */}
        <Dialog open={showRecorder} onOpenChange={setShowRecorder}>
          <DialogContent className="max-w-2xl bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Record Video</DialogTitle>
            </DialogHeader>
            <VideoRecorder
              onVideoRecorded={(blob) => {
                const file = new File([blob], 'swing-recording.webm', { type: 'video/webm' });
                setVideoFile(file);
                setShowRecorder(false);
                toast.success('Video recorded successfully!');
              }}
            />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
