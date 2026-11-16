import * as React from 'react';
import {
  Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription,
  DialogHeader, DialogFooter, DialogPortal, DialogOverlay,
} from './dialog';
import { buttonVariants } from './button';
import { cn } from '@/lib/utils';

// Destructive confirmations share the same popup layer as their forms.
const AlertDialog = Dialog;
const AlertDialogTrigger = DialogTrigger;
const AlertDialogContent = DialogContent;
const AlertDialogTitle = DialogTitle;
const AlertDialogDescription = DialogDescription;
const AlertDialogHeader = DialogHeader;
const AlertDialogFooter = DialogFooter;
const AlertDialogPortal = DialogPortal;
const AlertDialogOverlay = DialogOverlay;
const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof DialogClose>>(
  ({ className, ...props }, ref) => <DialogClose ref={ref} className={cn(buttonVariants(), className)} {...props} />,
);
AlertDialogAction.displayName = 'AlertDialogAction';
const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof DialogClose>>(
  ({ className, ...props }, ref) => <DialogClose ref={ref} className={cn(buttonVariants({ variant: 'outline' }), className)} {...props} />,
);
AlertDialogCancel.displayName = 'AlertDialogCancel';
export {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle, AlertDialogDescription,
  AlertDialogHeader, AlertDialogFooter, AlertDialogPortal, AlertDialogOverlay, AlertDialogAction, AlertDialogCancel,
};
