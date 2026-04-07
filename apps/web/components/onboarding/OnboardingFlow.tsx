import React, { useState, useEffect } from "react";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Progress } from "@repo/ui/progress";
import { Badge } from "@repo/ui/badge";
import {
  Camera,
  Sparkles,
  Wallet,
  User,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Star,
} from "lucide-react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  required?: boolean;
}

interface OnboardingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  userProgress?: {
    hasWallet?: boolean;
    hasAuth0?: boolean;
    hasTriedAR?: boolean;
    hasCompletedProfile?: boolean;
  };
}

export function OnboardingFlow({
  isOpen,
  onClose,
  onComplete,
  userProgress = {},
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to OnPoint",
      description: "Your AI-powered fashion stylist awaits",
      icon: <Sparkles className="w-6 h-6 text-purple-500" />,
      content: (
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">AI-Powered Fashion</h3>
            <p className="text-muted-foreground">
              Discover your perfect style with virtual try-on, personalized
              recommendations, and expert AI styling guidance.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <Camera className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm font-medium">Virtual Try-On</p>
            </div>
            <div className="text-center">
              <Sparkles className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <p className="text-sm font-medium">AI Styling</p>
            </div>
            <div className="text-center">
              <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm font-medium">Personal Style</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "wallet",
      title: "Connect Your Wallet",
      description: "Access premium features and secure transactions",
      icon: <Wallet className="w-6 h-6 text-blue-500" />,
      required: true,
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-medium mb-2">Why connect a wallet?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Access virtual try-on features</li>
              <li>• Purchase fashion items securely</li>
              <li>• Earn rewards for style contributions</li>
              <li>• Own your fashion data</li>
            </ul>
          </div>

          {userProgress.hasWallet ? (
            <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700">
                Wallet connected successfully!
              </span>
            </div>
          ) : (
            <Button className="w-full" size="lg">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          )}
        </div>
      ),
    },
    {
      id: "account",
      title: "Create Your Account",
      description: "Save your preferences and style history",
      icon: <User className="w-6 h-6 text-green-500" />,
      required: false,
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h4 className="font-medium mb-2">Account benefits:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Save your style preferences</li>
              <li>• Access your styling history</li>
              <li>• Get personalized recommendations</li>
              <li>• Sync across devices</li>
            </ul>
          </div>

          {userProgress.hasAuth0 ? (
            <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700">
                Account created successfully!
              </span>
            </div>
          ) : (
            <Button className="w-full" size="lg">
              <User className="w-4 h-4 mr-2" />
              Create Account
            </Button>
          )}
        </div>
      ),
    },
    {
      id: "virtual-tryon",
      title: "Try Virtual Styling",
      description: "Experience AI-powered fashion like never before",
      icon: <Camera className="w-6 h-6 text-purple-500" />,
      content: (
        <div className="space-y-4">
          <div className="aspect-video bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-12 h-12 text-purple-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Virtual Try-On Preview
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded-lg text-center">
              <Sparkles className="w-6 h-6 text-purple-500 mx-auto mb-1" />
              <p className="text-sm font-medium">AI Analysis</p>
              <p className="text-xs text-muted-foreground">Body type & style</p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <Star className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
              <p className="text-sm font-medium">Recommendations</p>
              <p className="text-xs text-muted-foreground">Personalized tips</p>
            </div>
          </div>

          {userProgress.hasTriedAR ? (
            <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700">
                Virtual try-on completed!
              </span>
            </div>
          ) : (
            <Button className="w-full" size="lg">
              <Camera className="w-4 h-4 mr-2" />
              Start Virtual Try-On
            </Button>
          )}
        </div>
      ),
    },
  ];

  useEffect(() => {
    if (userProgress.hasWallet) completedSteps.add("wallet");
    if (userProgress.hasAuth0) completedSteps.add("account");
    if (userProgress.hasTriedAR) completedSteps.add("virtual-tryon");
  }, [userProgress]);

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const canProceed =
    !currentStepData?.required ||
    (currentStepData?.id === "wallet" && userProgress.hasWallet) ||
    (currentStepData?.id === "account" && userProgress.hasAuth0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              {currentStepData?.icon}
              <span>{currentStepData?.title}</span>
            </CardTitle>
            <CardDescription>{currentStepData?.description}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                Step {currentStep + 1} of {steps.length}
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="flex space-x-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 h-1 rounded ${
                  index < currentStep
                    ? "bg-primary"
                    : index === currentStep
                      ? "bg-primary/60"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step Content */}
          <div className="min-h-[200px]">{currentStepData?.content}</div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <Button onClick={handleNext} disabled={!canProceed}>
              {isLastStep ? "Get Started" : "Next"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Skip Option */}
          {!currentStepData?.required && currentStep > 0 && (
            <div className="text-center">
              <button
                onClick={handleNext}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Skip this step
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
